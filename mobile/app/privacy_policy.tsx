import { useRouter } from "expo-router";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function PrivacyPolicy() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ChevronLeft size={20} color="#1C1C1E" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Data Privacy Notice</Text>
      </View>

      <ScrollView 
        style={styles.scroll} 
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 30 }]}
      >
        <Text style={styles.mainTitle}>Data Privacy Notice</Text>
        <Text style={styles.subtitle}>
          Issued pursuant to Republic Act No. 10173 (Data Privacy Act of 2012)
        </Text>

        {/* PREAMBLE */}
        <Section title="PREAMBLE">
          <Text style={styles.body}>
            <Text style={styles.bold}>PLANTSCOPE</Text> is a GIS-based reforestation
            monitoring and site suitability assessment platform developed by students of
            the{" "}
            <Text style={styles.bold}>
              College of ICT and Engineering, Western Leyte College of Ormoc City
            </Text>
            , in collaboration with the{" "}
            <Text style={styles.bold}>
              City Environment and Natural Resources Office (City ENRO)
            </Text>{" "}
            and the{" "}
            <Text style={styles.bold}>
              City Planning and Development Office (CPDO)
            </Text>{" "}
            of Ormoc City.
          </Text>
          <Text style={styles.body}>
            This Data Privacy Notice is issued pursuant to{" "}
            <Text style={styles.bold}>Republic Act No. 10173</Text>, known as the{" "}
            <Text style={styles.bold}>Data Privacy Act of 2012 (DPA)</Text>, and its
            Implementing Rules and Regulations (IRR).
          </Text>
          <View style={styles.highlight}>
            <Text style={styles.highlightText}>
              By registering an account or accessing any feature of PLANTSCOPE, users
              acknowledge that they have read and understood this notice.
            </Text>
          </View>
        </Section>

        {/* SECTION 1 */}
        <Section title="SECTION 1: PERSONAL INFORMATION CONTROLLER">
          <InfoRow label="Entity" value="City Environment and Natural Resources Office (City ENRO), Ormoc City LGU, in coordination with the College of ICT and Engineering, Western Leyte College of Ormoc City" />
          <InfoRow label="Address" value="A. Bonifacio St., Ormoc City, Leyte, Philippines" />
          <InfoRow label="DPO / Contact" value="Designated Data Protection Officer (DPO) of Ormoc City LGU or the PLANTSCOPE Data Manager (System Administrator)" />
          <InfoRow label="Email" value="system.admin@plantscope.gov.ph (to be assigned upon deployment)" />
          <InfoRow label="Phone" value="+63-XXX-XXX-XXXX (to be assigned upon deployment)" />
        </Section>

        {/* SECTION 2 */}
        <Section title="SECTION 2: PERSONAL DATA COLLECTED">
          <Text style={styles.body}>
            PLANTSCOPE collects the following categories of personal data from its
            registered users, depending on their assigned system role:
          </Text>
          <SubSection title="2.1 City ENRO Head">
            <BulletItem text="Full name, official email address, contact number" />
            <BulletItem text="Gender, birthday, address" />
            <BulletItem text="Username and encrypted password" />
            <BulletItem text="Login timestamps, session logs, and audit trail records" />
            <BulletItem text="High-level actions performed within the system (approvals, staff account authorization)" />
          </SubSection>
          <SubSection title="2.2 Data Manager (System Administrator)">
            <BulletItem text="Full name, official email address, contact number" />
            <BulletItem text="Username and encrypted password" />
            <BulletItem text="Gender, birthday, address" />
            <BulletItem text="Session logs and immutable audit trail records" />
          </SubSection>
          <SubSection title="2.3 GIS Specialist">
            <BulletItem text="Full name, official email address, contact number" />
            <BulletItem text="Username and encrypted password" />
            <BulletItem text="Gender, birthday, address" />
            <BulletItem text="Records of Onsite Inspector assignments (identity, target site, date)" />
            <BulletItem text="Audit trail logs of finalized site_data records with version history" />
          </SubSection>
          <SubSection title="2.4 Onsite Inspector (Mobile Application Users)">
            <BulletItem text="Full name, designation, assigned barangay or area" />
            <BulletItem text="Gender, birthday, address, contact details" />
            <BulletItem text="Username and encrypted password" />
            <BulletItem text="Field assessment submissions: safety indicators, boundary markers, soil data" />
            <BulletItem text="GPS coordinates (optional, when voluntarily submitted)" />
            <BulletItem text="Geotagged photographs and device metadata" />
          </SubSection>
          <SubSection title="2.5 Community User / Tree Growers">
            <BulletItem text="Full name and affiliated organization/group" />
            <BulletItem text="Gender, birthday, address, contact details" />
            <BulletItem text="Username and encrypted password" />
            <BulletItem text="Registration details and program preferences" />
            <BulletItem text="Tree planting progress updates and assigned site records" />
          </SubSection>
        </Section>

        {/* SECTION 3 */}
        <Section title="SECTION 3: SENSITIVE PERSONAL INFORMATION">
          <Text style={styles.body}>
            The following data may qualify as sensitive or privileged under Section
            3(l) of RA 10173:
          </Text>
          <Card>
            <Text style={styles.bold}>Precise GPS Coordinates: </Text>
            <Text style={styles.cardBody}>
              Location data tied to a person's presence at a field site may reveal
              movement patterns or physical location of government personnel.
            </Text>
          </Card>
          <Card>
            <Text style={styles.bold}>Geotagged Photographs: </Text>
            <Text style={styles.cardBody}>
              Photographs with embedded EXIF data contain both visual and locational
              sensitive information.
            </Text>
          </Card>
          <Card>
            <Text style={styles.bold}>Community Group Affiliation: </Text>
            <Text style={styles.cardBody}>
              Affiliation with schools or civic organizations may intersect with
              sensitive community information.
            </Text>
          </Card>
          <Text style={styles.note}>
            * GPS coordinate submission by Onsite Inspectors is optional and
            voluntary.
          </Text>
        </Section>

        {/* SECTION 4 */}
        <Section title="SECTION 4: PURPOSE AND LEGAL BASIS FOR DATA PROCESSING">
          <Text style={styles.body}>Processing is conducted on the basis of:</Text>
          <BulletItem text="Consent of the data subject (for community users, upon registration)" />
          <BulletItem text="Fulfillment of a contract or quasi-contract (for LGU personnel)" />
          <BulletItem text="Compliance with legal obligations (RA 10173, RA 7160, environmental laws)" />
          <BulletItem text="Exercise of official authority or performance of a task in the public interest" />
        </Section>

        {/* SECTION 5 */}
        <Section title="SECTION 5: HOW DATA IS USED AND PROCESSED">
          <BulletItem label="Collection" text="Data is gathered through the web platform, mobile field application, and community registration portal." />
          <BulletItem label="Storage" text="All data is stored in a PostgreSQL 13+ database deployed on Ormoc City LGU infrastructure." />
          <BulletItem label="Sharing" text="Personal data is shared only among authorized PLANTSCOPE users for official duties. Data is NOT sold, traded, or shared with unauthorized third parties." />
          <BulletItem label="Archiving & Disposal" text="Inactive records are managed through the Archive Data Management module. Data subject to deletion is irreversibly removed per retention schedules." />
        </Section>

        {/* SECTION 6 */}
        <Section title="SECTION 6: DATA RETENTION PERIOD">
          <RetentionRow label="User Account Data (LGU Staff)" value="Employment + 5 years" />
          <RetentionRow label="User Account Data (Community Users)" value="Active participation + 2 years" />
          <RetentionRow label="Field Assessment Records" value="Minimum 10 years" />
          <RetentionRow label="Finalized Site Records (site_data)" value="Permanent or until superseded" />
          <RetentionRow label="Audit Trail & Version History" value="Permanent" />
          <RetentionRow label="GPS Coordinates & Geotagged Photos" value="Monitoring program + 5 years" />
          <RetentionRow label="Community Program Records" value="Program duration + 5 years" />
          <RetentionRow label="System & Session Logs" value="1 year from record date" />
        </Section>

        {/* SECTION 7 */}
        <Section title="SECTION 7: SECURITY MEASURES">
          <Text style={styles.body}>
            PLANTSCOPE implements appropriate organizational, technical, and physical
            security measures in accordance with Section 20 of RA 10173 and NPC
            Circular No. 16-01.
          </Text>
          <SubSection title="7.1 Technical Security Measures">
            <BulletItem text="Password hashing & encryption using industry-standard cryptographic methods; TLS/SSL for data in transit" />
            <BulletItem text="Role-Based Access Control (RBAC) with minimum necessary permissions per role" />
            <BulletItem text="Token-based authentication with session expiration and automatic logout" />
            <BulletItem text="Audit trails with timestamps; finalized site_data records are versioned and immutable" />
          </SubSection>
          <SubSection title="7.2 Organizational Security Measures">
            <BulletItem text="Access limited to authorized LGU personnel and registered users" />
            <BulletItem text="Data minimization: only necessary data collected; optional fields clearly indicated" />
            <BulletItem text="Privacy by Design: data protection principles integrated from earliest development stages" />
          </SubSection>
        </Section>

        {/* SECTION 8 */}
        <Section title="SECTION 8: RIGHTS OF DATA SUBJECTS">
          <Text style={styles.body}>
            In accordance with Chapter IV of RA 10173, all users are entitled to the
            following rights:
          </Text>
          <Card>
            <Text style={styles.bold}>Right to be Informed: </Text>
            <Text style={styles.cardBody}>
              You have the right to know whether your personal data is being processed.
              This Notice fulfills that right.
            </Text>
          </Card>
          <Card>
            <Text style={styles.bold}>Right to Access: </Text>
            <Text style={styles.cardBody}>
              Request access to your personal data held by PLANTSCOPE, including copies
              and usage details.
            </Text>
          </Card>
          <Card>
            <Text style={styles.bold}>Right to Correction: </Text>
            <Text style={styles.cardBody}>
              Dispute inaccuracies and have them corrected without unreasonable delay.
            </Text>
          </Card>
          <Card>
            <Text style={styles.bold}>Right to Erasure or Blocking: </Text>
            <Text style={styles.cardBody}>
              Request deletion/blocking when data is incomplete, outdated, false, or
              unnecessary (subject to legal retention requirements).
            </Text>
          </Card>
          <Card>
            <Text style={styles.bold}>Right to Object: </Text>
            <Text style={styles.cardBody}>
              Object to processing in certain circumstances via written submission.
            </Text>
          </Card>
          <Card>
            <Text style={styles.bold}>Right to Data Portability: </Text>
            <Text style={styles.cardBody}>
              Obtain your data in a structured, machine-readable format where
              technically feasible.
            </Text>
          </Card>
          <Card>
            <Text style={styles.bold}>Right to Lodge a Complaint: </Text>
            <Text style={styles.cardBody}>
              File a complaint with the National Privacy Commission (NPC) if you
              believe your rights under RA 10173 have been violated.
            </Text>
          </Card>
          <Text style={styles.body}>
            Requests will be acknowledged within five (5) business days and acted upon
            within thirty (30) days.
          </Text>
        </Section>

        {/* SECTION 9 */}
        <Section title="SECTION 9: CONTACT INFORMATION">
          <View style={styles.contactCard}>
            <Text style={styles.contactTitle}>PRIMARY: PLANTSCOPE Data Manager</Text>
            <Text style={styles.contactBody}>
              City Environment and Natural Resources Office (City ENRO), Ormoc City LGU
            </Text>
            <Text style={styles.contactBody}>
              Email:{" "}
              <Text style={styles.green}>system.admin@plantscope.gov.ph</Text>
            </Text>
            <Text style={styles.contactBody}>Phone: +63-XXX-XXX-XXXX</Text>
          </View>
          <View style={styles.cardContainer}>
            <Text style={styles.contactTitle}>
              SECONDARY: Ormoc City LGU Data Protection Officer (DPO)
            </Text>
            <Text style={styles.contactBody}>
              Email: <Text style={styles.green}>dpo@ormoccity.gov.ph</Text>
            </Text>
            <Text style={styles.contactBody}>
              Office: Ormoc City Hall, A. Bonifacio St., Ormoc City
            </Text>
          </View>
          <View style={styles.cardContainer}>
            <Text style={styles.contactTitle}>
              REGULATORY AUTHORITY: National Privacy Commission (NPC)
            </Text>
            <Text style={styles.contactBody}>
              3F Core G Building, GSIS Complex, Roxas Blvd., Pasay City
            </Text>
            <Text style={styles.contactBody}>
              Email: <Text style={styles.green}>info@privacy.gov.ph</Text>
            </Text>
            <Text style={styles.contactBody}>
              Website: <Text style={styles.green}>www.privacy.gov.ph</Text>
            </Text>
          </View>
        </Section>

        {/* ACKNOWLEDGMENT */}
        <View style={styles.acknowledgment}>
          <Text style={styles.acknowledgmentText}>
            <Text style={styles.bold}>ACKNOWLEDGMENT:</Text> By accessing or using
            PLANTSCOPE, you confirm that you have read, understood, and agreed to this
            Data Privacy Notice.
          </Text>
          <Text style={styles.acknowledgmentSub}>
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

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.cardContainer}>{children}</View>;
}

function BulletItem({ text, label }: { text: string; label?: string }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bullet}>•</Text>
      <Text style={styles.bulletText}>
        {label ? <Text style={styles.bold}>{label}: </Text> : null}
        {text}
      </Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}:</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function RetentionRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.retentionRow}>
      <Text style={styles.retentionLabel}>{label}</Text>
      <Text style={styles.retentionValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.06)",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    marginRight: 12,
  },
  backText: {
    color: "#1C1C1E",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 4,
  },
  headerTitle: {
    color: "#1C1C1E",
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1C1C1E",
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
    borderTopWidth: 1,
    borderTopColor: "rgba(0, 0, 0, 0.06)",
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#22C55E",
    marginBottom: 10,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  subSection: {
    marginTop: 8,
    marginBottom: 4,
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 6,
  },
  body: {
    fontSize: 13,
    color: "#4B5563",
    lineHeight: 20,
    marginBottom: 8,
  },
  bold: {
    fontWeight: "700",
    color: "#1C1C1E",
  },
  highlight: {
    backgroundColor: "rgba(34, 197, 94, 0.06)",
    borderLeftWidth: 3,
    borderLeftColor: "#22C55E",
    paddingLeft: 12,
    paddingVertical: 10,
    paddingRight: 12,
    borderRadius: 6,
    marginTop: 8,
  },
  highlightText: {
    fontSize: 13,
    color: "#4B5563",
    fontStyle: "italic",
    lineHeight: 20,
  },
  cardContainer: {
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.04)",
  },
  cardBody: {
    fontSize: 13,
    color: "#4B5563",
    lineHeight: 18,
  },
  note: {
    fontSize: 12,
    color: "#16A34A",
    fontStyle: "italic",
    marginTop: 8,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 6,
    paddingLeft: 4,
  },
  bullet: {
    color: "#22C55E",
    marginRight: 8,
    fontSize: 14,
    lineHeight: 20,
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    color: "#4B5563",
    lineHeight: 20,
  },
  infoRow: {
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 12,
    color: "#4B5563",
    lineHeight: 18,
  },
  retentionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.06)",
  },
  retentionLabel: {
    flex: 1,
    fontSize: 12,
    color: "#4B5563",
    paddingRight: 8,
  },
  retentionValue: {
    fontSize: 12,
    color: "#22C55E",
    fontWeight: "600",
    textAlign: "right",
    flexShrink: 0,
  },
  contactCard: {
    backgroundColor: "rgba(34, 197, 94, 0.04)",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.15)",
  },
  contactTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 4,
  },
  contactBody: {
    fontSize: 12,
    color: "#4B5563",
    lineHeight: 18,
  },
  green: {
    color: "#22C55E",
    fontWeight: "600",
  },
  acknowledgment: {
    backgroundColor: "rgba(34, 197, 94, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.15)",
    borderRadius: 10,
    padding: 16,
    marginTop: 8,
    alignItems: "center",
  },
  acknowledgmentText: {
    fontSize: 13,
    color: "#1C1C1E",
    textAlign: "center",
    lineHeight: 20,
  },
  acknowledgmentSub: {
    fontSize: 11,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 8,
  },
});