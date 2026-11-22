"""Shared helpers for archiving (soft-deleting) maintenance records."""


def _active_rows(model):
    """Filter kwargs that select only non-archived rows of `model`, so records that are
    themselves archived don't block archiving their parent."""
    custom = getattr(model, 'ARCHIVE_ACTIVE_FILTER', None)
    if custom is not None:
        return custom
    field_names = {f.name for f in model._meta.get_fields()}
    if 'is_archived' in field_names:
        return {'is_archived': False}
    if 'deleted_at' in field_names:
        return {'deleted_at__isnull': True}
    return {}


def linked_records(instance, ignore=()):
    """Return [(label, count)] for every model that references `instance` through a
    foreign key / one-to-one / many-to-many and has active rows pointing at it.

    Relations are discovered via _meta, so newly added links are covered automatically.
    `ignore` is a collection of model names (e.g. the record's own child tables) to skip.
    """
    counts = {}  # label -> count; a model linked through two FKs is merged into one entry
    for rel in instance._meta.related_objects:
        model = rel.related_model
        if model.__name__ in ignore:
            continue
        # An explicit through table is already counted via its own FK; don't count it twice
        if rel.many_to_many and not rel.through._meta.auto_created:
            continue
        count = (
            model._base_manager
            .filter(**{rel.field.name: instance}, **_active_rows(model))
            .count()
        )
        if not count:
            continue
        # Some models have no verbose name, which yields labels like "classified_areass"
        label = str(model._meta.verbose_name_plural)
        if '_' in label:
            label = rel.get_accessor_name().replace('_', ' ')
        label = label.title()
        counts[label] = counts.get(label, 0) + count
    return list(counts.items())


def linked_records_error(instance, display_name, ignore=()):
    """Error payload explaining why `instance` can't be archived, or None if it has no links."""
    linked = linked_records(instance, ignore)
    if not linked:
        return None
    details = ', '.join(f'{count} {label}' for label, count in linked)
    return {
        'error': f'Cannot archive "{display_name}" because it is still linked to: {details}. '
                 f'Remove or reassign these records first.',
        'linked': [{'label': label, 'count': count} for label, count in linked],
    }
