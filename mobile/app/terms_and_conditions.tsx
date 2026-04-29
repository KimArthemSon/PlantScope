import { useRouter } from "expo-router";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { ChevronLeft } from "lucide-react-native";

export default function TermsAndConditions() {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={20} color="#ffffff" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms and Conditions</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.mainTitle}>Terms and Conditions</Text>
        <Text style={styles.subtitle}>
          Governing access, registration, and use of the PLANTSCOPE System
        </Text>

        {/* PREAMBLE */}
        <Section title="PREAMBLE">
          <Text style={styles.body}>
            These Terms and Conditions govern the access, registration, and use of{" "}
            <Text style={styles.bold}>PLANTSCOPE</Text> — a GIS-Based Site Suitability
            Assessment and Reforestation Monitoring System developed by students of the{" "}
            <Text style={styles.bold}>
              College of ICT and Engineering, Western Leyte College of Ormoc City
            </Text>
            , in collaboration with the{" "}
            <Text style={styles.bold}>City ENRO</Text> and{" "}
            <Text style={styles.bold}>CPDO</Text> of Ormoc City.
          </Text>
          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>⚠️ IMPORTANT – PLEASE READ CAREFULLY</Text>
            <Text style={styles.warningBody}>
              By registering an account, logging in, or otherwise accessing
              PLANTSCOPE, you acknowledge that you have read, understood, and agree to
              be legally bound by these Terms and Conditions in their entirety. If you
              do not agree, you must immediately discontinue use and request account
              deactivation from the Data Manager.
            </Text>
          </View>
        </Section>

        {/* SECTION 1 */}
        <Section title="SECTION 1: SCOPE AND PURPOSE OF SYSTEM USE">
          <SubSection title="1.1 Scope">
            <Text style={styles.body}>
              These Terms and Conditions apply to all individuals who access, register,
              or use PLANTSCOPE in any capacity, including:
            </Text>
            <BulletItem label="City ENRO Head (The Head)" text="— primary authority for reforestation program oversight and LGU staff account authorization and audit trails" />
            <BulletItem label="Data Manager (System Administrator)" text="— maintains technical and data integrity, oversees archive management" />
            <BulletItem label="GIS Specialists" text="— perform technical site suitability validation and manage spatial data" />
            <BulletItem label="Onsite Inspectors" text="— collect and submit field assessment data through the mobile application" />
            <BulletItem label="Community Users (Tree Growers)" text="— register for the Public Tree Planting Program and submit planting progress updates" />
          </SubSection>

          <SubSection title="1.2 Purpose">
            <Text style={styles.body}>
              PLANTSCOPE is designed exclusively to support the following government
              functions of Ormoc City:
            </Text>
            <PurposeCard title="Reforestation Site Assessment" body="Identify, evaluate, and validate suitable tree planting locations through NDVI pre-screening and MCDA." />
            <PurposeCard title="Field Data Collection" body="Enable Onsite Inspectors to collect structured field observations, safety indicators, soil data, GPS coordinates, and geotagged photographs via the mobile application." />
            <PurposeCard title="Reforestation Monitoring" body="Track post-planting progress, tree survival rates, and maintenance activities for validated reforestation sites." />
            <PurposeCard title="Community Engagement" body="Facilitate participation of schools, organizations, and groups in the Public Tree Planting Program." />
            <PurposeCard title="Archive Data Management" body="Oversee storage, restoration, and permanent deletion of records in accordance with government retention policies." />
            <PurposeCard title="Compliance & Audit" body="Maintain immutable audit trails and versioned site_data records for accountability and evidence-based environmental governance." />
          </SubSection>

          <SubSection title="1.3 Non-Commercial Use">
            <Text style={styles.body}>
              PLANTSCOPE is a non-commercial, government-deployed environmental
              management system developed as an academic capstone project. It shall not
              be used for commercial gain, private business operations, or activities
              outside the environmental mandate of the Ormoc City LGU.
            </Text>
          </SubSection>
        </Section>

        {/* SECTION 2 */}
        <Section title="SECTION 2: USER RESPONSIBILITIES AND ACCEPTABLE USE">
          <SubSection title="2.1 General Responsibilities of All Users">
            <BulletItem label="Account Security" text="Users are solely responsible for maintaining the confidentiality of their login credentials. Unauthorized use of a user account must be reported immediately to the Data Manager." />
            <BulletItem label="Accuracy of Information" text="All data, records, and submissions must be accurate, truthful, and complete. Submission of false, fabricated, or misleading information is strictly prohibited." />
            <BulletItem label="Role Compliance" text="Users must access and use only the features and data authorized for their assigned role." />
            <BulletItem label="System Integrity" text="Users must not perform any action that compromises the integrity, availability, or security of the PLANTSCOPE system." />
            <BulletItem label="Compliance with Laws" text="Users must comply with all applicable Philippine laws, including RA 10173, RA 7160, environmental protection laws, and civil service regulations." />
          </SubSection>

          <SubSection title="2.2 Role-Specific Responsibilities">
            <RoleCard title="City ENRO Head (The Head)">
              <BulletItem text="Acts as the primary authority for the reforestation program and system oversight" />
              <BulletItem text="Authorizes the creation of LGU staff accounts for the system" />
              <BulletItem text="Reviews high-level descriptive analytics reports on program performance and site status" />
              <BulletItem text="Serves as a primary contact for legal and privacy concerns related to the system" />
              <BulletItem text="Ensures that system operations remain aligned with the environmental mandate of the Ormoc City LGU" />
            </RoleCard>
            <RoleCard title="Data Manager (System Administrator)">
              <BulletItem text="Maintains technical and data integrity consistent throughout the system cycle" />
              <BulletItem text="Oversees Archive Data Management — ensuring records are stored or disposed of according to government retention policies" />
              <BulletItem text="Serves as the primary system contact for data privacy concerns, security incidents, and technical issues" />
            </RoleCard>
            <RoleCard title="GIS Specialist">
              <BulletItem text="Reviews all inspector-submitted field_assessment_data with professional objectivity before finalizing site records" />
              <BulletItem text="Performs MCDA validation decisions (ACCEPT / REJECT / ACCEPT_WITH_CONDITIONS) only after thorough evaluation" />
              <BulletItem text="Provides accurate justification notes for every validation decision to preserve the integrity of the audit trail" />
              <BulletItem text="Ensures that finalized site_data records are complete and correct before setting is_current = true" />
              <BulletItem text="Treats all site data, spatial records, and related information as confidential government information" />
            </RoleCard>
            <RoleCard title="Onsite Inspector (Mobile Application)">
              <BulletItem text="Submits field assessment data based on direct, first-hand observation at the assigned site" />
              <BulletItem text="Do not fabricate, estimate without basis, or copy data from other submissions" />
              <BulletItem text="Ensures that geotagged photographs are taken at the actual field site" />
              <BulletItem text="GPS coordinates, when submitted, must reflect the actual location of the assessment site" />
              <BulletItem text="Reports any technical issues with the mobile application or data synchronization to the Data Manager promptly" />
              <BulletItem text="Must only conduct field assessments at the specific site they have been officially assigned to" />
            </RoleCard>
            <RoleCard title="Community User / Tree Grower">
              <BulletItem text="Provides accurate registration information including full name, contact details, and organizational affiliation" />
              <BulletItem text="Submits genuine and timely progress updates for assigned tree planting sites" />
              <BulletItem text="Complies with the assigned schedule and site allocation provided by the Data Manager" />
              <BulletItem text="Notifies the Data Manager of any change in contact information or organizational status" />
              <BulletItem text="Responsible for ensuring that participants they represent are aware of these Terms and Conditions" />
            </RoleCard>
          </SubSection>
        </Section>

        {/* SECTION 3 */}
        <Section title="SECTION 3: PROHIBITED ACTIVITIES">
          <Text style={styles.body}>
            The following activities are strictly prohibited on PLANTSCOPE. Violation
            may result in immediate account suspension, referral to appropriate
            authorities, and legal action under applicable Philippine laws.
          </Text>
          <ProhibitedCard number="01" title="Unauthorized Access" body="Accessing, attempting to access, or gaining entry to any account, data record, GIS layer, or system feature not authorized for your assigned role." />
          <ProhibitedCard number="02" title="Credential Sharing & Impersonation" body="Sharing or transferring your login credentials to any other person. Logging into the system using another user's credentials." />
          <ProhibitedCard number="03" title="Submission of False Data" body="Entering or submitting data that is knowingly false, fabricated, or deliberately misleading — including falsified field observations, fake GPS coordinates, or manipulated photographs." />
          <ProhibitedCard number="04" title="Unauthorized Data Extraction" body="Copying, exporting, or transmitting personal data, spatial records, or government maps to unauthorized individuals or external platforms." />
          <ProhibitedCard number="05" title="System Tampering" body="Introducing malicious code, performing denial-of-service attacks, SQL injection, or any form of technical interference that disrupts the system." />
          <ProhibitedCard number="06" title="Unauthorized Modification/Deletion" body="Modifying, overwriting, or deleting any system record without proper authority. The Data Manager may only archive or delete records per approved retention policies." />
          <ProhibitedCard number="07" title="Misuse of Personal Data" body="Using personal data accessed through PLANTSCOPE for any purpose other than those explicitly stated in these Terms and the Data Privacy Notice." />
          <ProhibitedCard number="08" title="Use Outside Authorized Scope" body="Using PLANTSCOPE for activities beyond its stated environmental management and reforestation functions." />
          <View style={styles.legalWarning}>
            <Text style={styles.legalTitle}>⚖️ Legal Warning</Text>
            <Text style={styles.legalBody}>
              Violations may constitute criminal offenses under RA 10173 (Data Privacy
              Act), RA 10175 (Cybercrime Prevention Act), RA 3019 (Anti-Graft), and
              other applicable Philippine laws. The Ormoc City LGU reserves the right
              to refer violations to the National Privacy Commission, law enforcement,
              or other competent bodies.
            </Text>
          </View>
        </Section>

        {/* SECTION 4 */}
        <Section title="SECTION 4: DATA OWNERSHIP AND HANDLING RESPONSIBILITIES">
          <SubSection title="4.1 Ownership of System Data">
            <Text style={styles.body}>
              All data submitted to, processed by, or generated within PLANTSCOPE is
              the property of the{" "}
              <Text style={styles.bold}>Ormoc City Local Government Unit</Text>,
              acting through City ENRO and CPDO. Personal data submitted by individual
              users remains subject to the rights of the data subject under RA 10173.
            </Text>
          </SubSection>
          <SubSection title="4.3 Data Sharing Restrictions">
            <BulletItem text="Personal data shall not be disclosed to private companies, commercial entities, or individuals not affiliated with the system's official mandate." />
            <BulletItem text="Spatial data, GIS maps, and site records derived from PLANTSCOPE shall not be published or commercialized without prior written approval of the CPDO and City ENRO." />
            <BulletItem text="Aggregate, de-identified data may be used for academic research with LGU approval, provided that individual users cannot be identified." />
          </SubSection>
        </Section>

        {/* SECTION 5 */}
        <Section title="SECTION 5: ACCOUNT MANAGEMENT AND ACCESS CONTROL">
          <SubSection title="5.1 Account Registration">
            <BulletItem text="LGU staff accounts (Head, Data Manager, GIS Specialists, Onsite Inspectors) are created by the Head." />
            <BulletItem text="Community user accounts require submission of a registration request through the community portal, subject to review from the Data Manager with final approval by the Head." />
            <BulletItem text="Providing false registration information is grounds for immediate account rejection or termination." />
          </SubSection>
          <SubSection title="5.2 Account Suspension and Termination">
            <Text style={styles.body}>
              The Data Manager, upon direction from the Head, reserves the right to
              suspend or permanently deactivate any user account under the following
              circumstances:
            </Text>
            <BulletItem text="Violation of any provision of these Terms and Conditions" />
            <BulletItem text="Submission of false or fraudulent information" />
            <BulletItem text="Unauthorized access or security breach originating from the user account" />
            <BulletItem text="Separation, reassignment, or resignation of LGU personnel from their relevant duties" />
            <BulletItem text="Completion or withdrawal from the Public Tree Planting Program (for community users)" />
            <BulletItem text="Receipt of a lawful order requiring account termination from a competent authority" />
          </SubSection>
        </Section>

        {/* SECTION 6 */}
        <Section title="SECTION 6: LIMITATION OF LIABILITY">
          <LiabilityCard title="6.1 No Warranty of Uninterrupted Service" body='PLANTSCOPE is provided on an "as-is" and "as-available" basis. The development team and Western Leyte College of Ormoc City make no warranty that the system will operate without interruption, error, or defect at all times.' />
          <LiabilityCard title="6.2 No Liability for User-Submitted Data" body="The system does not automatically verify the accuracy of user-submitted data. The PLANTSCOPE development team shall not be liable for decisions made based on inaccurate, incomplete, or false data submitted by users." />
          <LiabilityCard title="6.3 Data Manager Accountability" body="The Data Manager bears institutional responsibility for the proper administration of system records and audit trails. Unauthorized manipulation of records by the Data Manager constitutes a serious violation of these Terms and applicable law." />
          <LiabilityCard title="6.4 LGU Operational Liability" body="The Ormoc City LGU, acting through City ENRO and CPDO, assumes operational responsibility for the deployed PLANTSCOPE system and for decisions made based on its outputs." />
          <LiabilityCard title="6.5 Force Majeure" body="Neither the system developer nor the LGU shall be held liable for any failure to perform obligations caused by circumstances beyond reasonable control, including natural disasters, acts of war, or government-mandated system shutdowns." />
        </Section>

        {/* SECTION 7 */}
        <Section title="SECTION 7: COMPLIANCE WITH RA 10173 – DATA PRIVACY ACT OF 2012">
          <Text style={styles.body}>
            PLANTSCOPE is designed and operated in full compliance with Republic Act
            No. 10173 and its IRR, as enforced by the National Privacy Commission
            (NPC) of the Philippines.
          </Text>
          <PurposeCard title="Transparency" body="Users are informed of all data collection and processing through the PLANTSCOPE Data Privacy Notice, issued alongside these Terms." />
          <PurposeCard title="Legitimate Purpose" body="Personal data is collected exclusively for reforestation management, field monitoring, community engagement, and audit functions of the Ormoc City LGU." />
          <PurposeCard title="Proportionality" body="Only the minimum personal data necessary for each role's functions is collected. GPS coordinates are optional." />
          <PurposeCard title="Data Security" body="Technical and organizational security measures are implemented including encryption, RBAC, and immutable audit trails managed by the Data Manager." />
          <PurposeCard title="Data Subject Rights" body="All registered users retain their rights under Chapter IV of RA 10173, exercisable through the Data Manager or the LGU DPO." />
          <PurposeCard title="Data Retention & Disposal" body="Data is retained per the schedules in the PLANTSCOPE Data Privacy Notice and disposed of securely by the Data Manager upon expiration." />
          <Text style={styles.note}>
            These Terms and Conditions must be read in conjunction with the PLANTSCOPE
            Data Privacy Notice. In matters of data privacy, the Data Privacy Notice
            shall prevail.
          </Text>
        </Section>

        {/* SECTION 8 */}
        <Section title="SECTION 8: ACCEPTANCE OF TERMS AND CONDITIONS">
          <Text style={styles.body}>
            By accessing or using PLANTSCOPE, you expressly confirm and agree to the
            following:
          </Text>
          <View style={styles.acceptanceBox}>
            <Text style={styles.acceptanceText}>
              1. I have read, understood, and voluntarily agree to comply with all
              provisions of these Terms and Conditions.
            </Text>
            <Text style={styles.acceptanceText}>
              2. I have read and understood the PLANTSCOPE Data Privacy Notice and
              consent to the collection, processing, and use of my personal data as
              described therein.
            </Text>
            <Text style={styles.acceptanceText}>
              3. I understand that continued use of PLANTSCOPE after any amendment to
              these Terms and Conditions is effective shall constitute my acceptance of
              the updated Terms.
            </Text>
            <Text style={styles.acceptanceText}>
              4. I understand that violation of these Terms and Conditions may result
              in account suspension, termination, and legal consequences under
              applicable Philippine law.
            </Text>
            <Text style={styles.acceptanceText}>
              5. I affirm that all information I provide to the system is accurate,
              truthful, and complete, and I accept full responsibility for the data I
              submit.
            </Text>
            <Text style={styles.acceptanceText}>
              6. I acknowledge that PLANTSCOPE is a government-deployed environmental
              management system and commit to using it exclusively for its stated
              purposes.
            </Text>
          </View>
        </Section>

        {/* SECTION 9 */}
        <Section title="SECTION 9: GOVERNING LAW AND JURISDICTION">
          <Text style={styles.body}>
            These Terms and Conditions shall be governed by the laws of the Republic
            of the Philippines, including RA 10173, RA 10175, RA 7160, RA 3019, and
            NPC Circulars. Any dispute shall be subject to the jurisdiction of the
            appropriate government agencies and courts, with venue in{" "}
            <Text style={styles.bold}>Ormoc City, Leyte</Text>.
          </Text>
        </Section>

        {/* FOOTER */}
        <View style={styles.docFooter}>
          <Text style={styles.docFooterTitle}>
            TERMS AND CONDITIONS – END OF DOCUMENT
          </Text>
          <Text style={styles.docFooterSub}>
            This document is to be read together with the PLANTSCOPE Data Privacy
            Notice.
          </Text>
          <Text style={styles.docFooterMini}>
            PLANTSCOPE | Western Leyte College of Ormoc City | College of ICT and
            Engineering | RA 10173 Compliant
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.subSection}>
      <Text style={styles.subSectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function BulletItem({ text, label }: { text: string; label?: string }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bullet}>•</Text>
      <Text style={styles.bulletText}>
        {label ? <Text style={styles.bold}>{label} </Text> : null}
        {text}
      </Text>
    </View>
  );
}

function PurposeCard({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.purposeCard}>
      <Text style={styles.purposeTitle}>{title}</Text>
      <Text style={styles.purposeBody}>{body}</Text>
    </View>
  );
}

function RoleCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.roleCard}>
      <Text style={styles.roleTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ProhibitedCard({ number, title, body }: { number: string; title: string; body: string }) {
  return (
    <View style={styles.prohibitedCard}>
      <Text style={styles.prohibitedTitle}>{number}. {title}</Text>
      <Text style={styles.prohibitedBody}>{body}</Text>
    </View>
  );
}

function LiabilityCard({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.liabilityCard}>
      <Text style={styles.bold}>{title}</Text>
      <Text style={styles.liabilityBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0d2a17",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: "#0d2a17",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 999,
    marginRight: 12,
  },
  backText: {
    color: "#ffffff",
    fontSize: 14,
    marginLeft: 4,
  },
  headerTitle: {
    color: "#7CD56A",
    fontSize: 16,
    fontWeight: "bold",
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  mainTitle: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#7CD56A",
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#7CD56A",
    marginBottom: 10,
  },
  subSection: {
    marginTop: 8,
    marginBottom: 4,
  },
  subSectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 6,
  },
  body: {
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
    lineHeight: 20,
    marginBottom: 8,
  },
  bold: {
    fontWeight: "bold",
    color: "#ffffff",
  },
  note: {
    fontSize: 12,
    color: "#7CD56A",
    fontStyle: "italic",
    marginTop: 8,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 4,
    paddingLeft: 4,
  },
  bullet: {
    color: "#7CD56A",
    marginRight: 8,
    fontSize: 13,
    lineHeight: 20,
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
    lineHeight: 20,
  },
  warningBox: {
    backgroundColor: "rgba(239,68,68,0.1)",
    borderLeftWidth: 4,
    borderLeftColor: "#ef4444",
    paddingLeft: 12,
    paddingVertical: 10,
    paddingRight: 10,
    borderRadius: 4,
    marginTop: 8,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 4,
  },
  warningBody: {
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
    lineHeight: 18,
  },
  purposeCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  purposeTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#7CD56A",
    marginBottom: 2,
  },
  purposeBody: {
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    lineHeight: 18,
  },
  roleCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#7CD56A",
  },
  roleTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 6,
  },
  prohibitedCard: {
    backgroundColor: "rgba(239,68,68,0.1)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  prohibitedTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 3,
  },
  prohibitedBody: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    lineHeight: 18,
  },
  legalWarning: {
    backgroundColor: "rgba(239,68,68,0.1)",
    borderWidth: 1,
    borderColor: "#ef4444",
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  legalTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 4,
  },
  legalBody: {
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
    lineHeight: 18,
  },
  liabilityCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  liabilityBody: {
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    lineHeight: 18,
    marginTop: 2,
  },
  acceptanceBox: {
    backgroundColor: "rgba(124,213,106,0.1)",
    borderWidth: 1,
    borderColor: "#7CD56A",
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  acceptanceText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.9)",
    lineHeight: 20,
  },
  docFooter: {
    backgroundColor: "rgba(124,213,106,0.1)",
    borderWidth: 1,
    borderColor: "#7CD56A",
    borderRadius: 8,
    padding: 14,
    marginTop: 8,
    alignItems: "center",
  },
  docFooterTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
  },
  docFooterSub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    marginTop: 4,
  },
  docFooterMini: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    marginTop: 6,
  },
});
