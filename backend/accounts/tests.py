import hashlib
import json
import re
from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from .models import User, PasswordResetCode
from . import password_reset_views as prv

OLD_PASSWORD = 'OldPass#123'
NEW_PASSWORD = 'NewPass#456'


def _sha(v):
    return hashlib.sha256(v.encode()).hexdigest()


@patch('accounts.password_reset_views.resend.Emails.send')
class PasswordResetTests(TestCase):
    def setUp(self):
        self.user = User.objects.create(email='grower@example.com', password=_sha(OLD_PASSWORD), user_role='treeGrowers')

    def post(self, step, body, platform='mobile'):
        body = {'platform': platform, **body}
        return self.client.post(f'/api/password_reset/{step}/', json.dumps(body), content_type='application/json')

    def sent_code(self, mock_send):
        html = mock_send.call_args[0][0]['html']
        return re.search(r'>(\d{6})</span>', html).group(1)

    def age_requests(self, seconds):
        PasswordResetCode.objects.update(created_at=timezone.now() - timedelta(seconds=seconds))

    def test_full_flow_changes_password(self, mock_send):
        res = self.post('request', {'email': 'Grower@Example.com'})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['requests_left'], 2)

        res = self.post('verify', {'email': 'grower@example.com', 'code': self.sent_code(mock_send)})
        self.assertEqual(res.status_code, 200)
        token = res.json()['reset_token']

        res = self.post('confirm', {'email': 'grower@example.com', 'reset_token': token, 'new_password': NEW_PASSWORD})
        self.assertEqual(res.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.password, _sha(NEW_PASSWORD))

        # Token is single use
        res = self.post('confirm', {'email': 'grower@example.com', 'reset_token': token, 'new_password': 'Other#7890'})
        self.assertEqual(res.status_code, 400)

    def test_unknown_email(self, mock_send):
        self.assertEqual(self.post('request', {'email': 'nobody@example.com'}).status_code, 404)
        mock_send.assert_not_called()

    def test_cooldown_between_requests(self, mock_send):
        self.assertEqual(self.post('request', {'email': self.user.email}).status_code, 200)
        res = self.post('request', {'email': self.user.email})
        self.assertEqual(res.status_code, 429)
        self.assertNotIn('limit_reached', res.json())

    def test_daily_limit(self, mock_send):
        for _ in range(prv.MAX_REQUESTS_PER_DAY):
            self.assertEqual(self.post('request', {'email': self.user.email}).status_code, 200)
            self.age_requests(120)  # skip past the cooldown
        res = self.post('request', {'email': self.user.email})
        self.assertEqual(res.status_code, 429)
        self.assertTrue(res.json()['limit_reached'])

        # A day later the limit resets
        self.age_requests(24 * 3600 + 1)
        self.assertEqual(self.post('request', {'email': self.user.email}).status_code, 200)

    def test_failed_send_does_not_count(self, mock_send):
        mock_send.side_effect = Exception('smtp down')
        self.assertEqual(self.post('request', {'email': self.user.email}).status_code, 500)
        self.assertEqual(PasswordResetCode.objects.count(), 0)

    def test_wrong_code_attempts_burn_code(self, mock_send):
        self.post('request', {'email': self.user.email})
        code = self.sent_code(mock_send)
        wrong = '000000' if code != '000000' else '111111'
        for _ in range(prv.MAX_VERIFY_ATTEMPTS):
            self.assertEqual(self.post('verify', {'email': self.user.email, 'code': wrong}).status_code, 400)
        # Even the right code no longer works
        self.assertEqual(self.post('verify', {'email': self.user.email, 'code': code}).status_code, 400)

    def test_weak_or_same_password_rejected(self, mock_send):
        self.post('request', {'email': self.user.email})
        token = self.post('verify', {'email': self.user.email, 'code': self.sent_code(mock_send)}).json()['reset_token']
        self.assertEqual(self.post('confirm', {'email': self.user.email, 'reset_token': token, 'new_password': 'weak'}).status_code, 400)
        self.assertEqual(self.post('confirm', {'email': self.user.email, 'reset_token': token, 'new_password': OLD_PASSWORD}).status_code, 400)

    def test_field_roles_blocked_on_web(self, mock_send):
        for role in ('treeGrowers', 'OnsiteInspector'):
            self.user.user_role = role
            self.user.save()
            res = self.post('request', {'email': self.user.email}, platform='web')
            self.assertEqual(res.status_code, 403)
            self.assertTrue(res.json()['wrong_platform'])
        mock_send.assert_not_called()

    def test_office_roles_blocked_on_mobile(self, mock_send):
        self.user.user_role = 'DataManager'
        self.user.save()
        self.assertEqual(self.post('request', {'email': self.user.email}, platform='mobile').status_code, 403)
        self.assertEqual(self.post('request', {'email': self.user.email}, platform='web').status_code, 200)

    def test_cannot_switch_platform_before_confirm(self, mock_send):
        self.post('request', {'email': self.user.email})
        token = self.post('verify', {'email': self.user.email, 'code': self.sent_code(mock_send)}).json()['reset_token']
        res = self.post('confirm', {'email': self.user.email, 'reset_token': token, 'new_password': NEW_PASSWORD}, platform='web')
        self.assertEqual(res.status_code, 403)
        self.user.refresh_from_db()
        self.assertEqual(self.user.password, _sha(OLD_PASSWORD))
