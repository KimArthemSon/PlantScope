import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Platform,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { Shield, CheckCircle } from "lucide-react-native";

type PrivacyPolicyModalProps = {
  visible: boolean;
  onClose: () => void;
  onViewed?: () => void;
  hasViewed?: boolean;
};

export default function PrivacyPolicyModal({
  visible,
  onClose,
  onViewed,
  hasViewed = false,
}: PrivacyPolicyModalProps) {
  const [canConfirm, setCanConfirm] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const scrollMetrics = useRef({ contentLength: 0, visibleLength: 0, offset: 0 });

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 40;
    const isAtBottom =
      layoutMeasurement.height + contentOffset.y >=
      contentSize.height - paddingToBottom;
    setCanConfirm(isAtBottom || hasViewed);
  };

  const handleConfirm = () => {
    if (onViewed) onViewed();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Shield size={18} color="#4caf72" />
            <Text style={styles.title}>Data Privacy Notice</Text>
            {hasViewed && (
              <View style={styles.viewedBadge}>
                <CheckCircle size={12} color="#4caf72" />
                <Text style={styles.viewedText}>Viewed</Text>
              </View>
            )}
          </View>
          <Text style={styles.effective}>
            Issued pursuant to Republic Act No. 10173 (Data Privacy Act of 2012)
          </Text>
          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            showsVerticalScrollIndicator={true}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            <Text style={styles.sectionTitle}>PREAMBLE</Text>
            <Text style={styles.body}>
              <Text style={styles.bold}>PLANTSCOPE</Text> is a GIS-based
              reforestation monitoring and site suitability assessment platform
              developed by students of the{" "}
              <Text style={styles.bold}>
                College of ICT and Engineering, Western Leyte College of Ormoc
                City
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
              This Data Privacy Notice explains how PLANTSCOPE collects, uses,
              stores, protects, and disposes of personal data from its users,
              and informs all data subjects of their rights under Philippine
              law.
            </Text>
            <View style={styles.highlightBox}>
              <Text style={styles.highlightText}>
                By registering an account or accessing any feature of
                PLANTSCOPE, users acknowledge that they have read and understood
                this notice.
              </Text>
            </View>
            <Text style={styles.sectionTitle}>
              SECTION 1: PERSONAL INFORMATION CONTROLLER
            </Text>
            <Text style={styles.body}>
              <Text style={styles.bold}>Entity: </Text>City Environment and
              Natural Resources Office (City ENRO), Ormoc City LGU, in
              coordination with the College of ICT and Engineering, Western
              Leyte College of Ormoc City{"\n"}
              <Text style={styles.bold}>Address: </Text>A. Bonifacio St.,
              Ormoc City, Leyte, Philippines{"\n"}
              <Text style={styles.bold}>DPO / Contact: </Text>Designated Data
              Protection Officer (DPO) of Ormoc City LGU or the PLANTSCOPE Data
              Manager{"\n"}
              <Text style={styles.bold}>Email: </Text>
              system.admin@plantscope.gov.ph{"\n"}
              <Text style={styles.bold}>Phone: </Text>+63-XXX-XXX-XXXX (to be
              assigned upon deployment)
            </Text>
            <Text style={styles.sectionTitle}>
              SECTION 2: PERSONAL DATA COLLECTED
            </Text>
            <Text style={styles.body}>
              PLANTSCOPE collects the following categories of personal data from
              its registered users, depending on their assigned system role:
            </Text>
            <Text style={styles.subHeading}>
              2.5 Community User / Tree Growers
            </Text>
            <Text style={styles.body}>
              {"• Full name and affiliated group\n"}
              {"• Gender, address, contact details\n"}
              {"• Username and encrypted password\n"}
              {"• Registration details and program preferences\n"}
              {"• Tree planting progress updates and assigned site records"}
            </Text>
            <Text style={styles.sectionTitle}>
              SECTION 3: SENSITIVE PERSONAL INFORMATION
            </Text>
            <Text style={styles.body}>
              The following data may qualify as sensitive or privileged under
              Section 3(l) of RA 10173:
            </Text>
            <Text style={styles.body}>
              <Text style={styles.bold}>Precise GPS Coordinates: </Text>
              Location data tied to a person's presence at a field site may
              reveal movement patterns or physical location.{"\n\n"}
              <Text style={styles.bold}>Geotagged Photographs: </Text>
              Photographs with embedded EXIF data contain both visual and
              locational sensitive information.{"\n\n"}
              <Text style={styles.bold}>Community Group Affiliation: </Text>
              Affiliation with schools or civic organizations may intersect with
              sensitive community information.
            </Text>
            <Text style={styles.noteText}>
              * GPS coordinate submission by Onsite Inspectors is optional and
              voluntary.
            </Text>
            <Text style={styles.sectionTitle}>
              SECTION 4: PURPOSE AND LEGAL BASIS FOR DATA PROCESSING
            </Text>
            <Text style={styles.body}>
              Processing is conducted on the basis of:
            </Text>
            <Text style={styles.body}>
              {
                "• Consent of the data subject (for community users, upon registration)\n"
              }
              {
                "• Fulfillment of a contract or quasi-contract (for LGU personnel)\n"
              }
              {
                "• Compliance with legal obligations (RA 10173, RA 7160, environmental laws)\n"
              }
              {
                "• Exercise of official authority or performance of a task in the public interest"
              }
            </Text>
            <Text style={styles.sectionTitle}>
              SECTION 5: HOW DATA IS USED AND PROCESSED
            </Text>
            <Text style={styles.body}>
              <Text style={styles.bold}>Collection: </Text>Data is gathered
              through the web platform, mobile field application, and community
              registration portal.{"\n\n"}
              <Text style={styles.bold}>Storage: </Text>All data is stored in
              a PostgreSQL 13+ database deployed on Ormoc City LGU
              infrastructure.{"\n\n"}
              <Text style={styles.bold}>Sharing: </Text>Personal data is
              shared only among authorized PLANTSCOPE users for official duties.
              Data is <Text style={styles.bold}>NOT</Text> sold, traded, or
              shared with unauthorized third parties.{"\n\n"}
              <Text style={styles.bold}>Archiving & Disposal: </Text>Inactive
              records are managed through the Archive Data Management module.
              Data subject to deletion is irreversibly removed per retention
              schedules.
            </Text>
            <Text style={styles.sectionTitle}>
              SECTION 6: DATA RETENTION PERIOD
            </Text>
            <Text style={styles.body}>
              {"• User Account Data (LGU Staff): Employment + 5 years\n"}
              {
                "• User Account Data (Community Users): Active participation + 2 years\n"
              }
              {"• Field Assessment Records: Minimum 10 years\n"}
              {"• Finalized Site Records: Permanent or until superseded\n"}
              {"• Audit Trail & Version History: Permanent\n"}
              {
                "• GPS Coordinates & Geotagged Photos: Monitoring program + 5 years\n"
              }
              {"• Community Program Records: Program duration + 5 years\n"}
              {"• System & Session Logs: 1 year from record date"}
            </Text>
            <Text style={styles.sectionTitle}>
              SECTION 7: SECURITY MEASURES
            </Text>
            <Text style={styles.body}>
              PLANTSCOPE implements appropriate organizational, technical, and
              physical security measures in accordance with Section 20 of RA
              10173 and NPC Circular No. 16-01:
            </Text>
            <Text style={styles.body}>
              {
                "• Password hashing & encryption using industry-standard cryptographic methods; TLS/SSL for data in transit\n"
              }
              {
                "• Role-Based Access Control (RBAC) with minimum necessary permissions per role\n"
              }
              {
                "• Token-based authentication with session expiration and automatic logout\n"
              }
              {
                "• Audit trails with timestamps; finalized site_data records are versioned and immutable\n"
              }
              {
                "• Data minimization: only necessary data collected; optional fields clearly indicated"
              }
            </Text>
            <Text style={styles.sectionTitle}>
              SECTION 8: RIGHTS OF DATA SUBJECTS
            </Text>
            <Text style={styles.body}>
              In accordance with Chapter IV of RA 10173, all users are entitled
              to:
            </Text>
            <Text style={styles.body}>
              {"• Right to be Informed\n"}
              {"• Right to Access\n"}
              {"• Right to Correction\n"}
              {"• Right to Erasure or Blocking\n"}
              {"• Right to Object\n"}
              {"• Right to Data Portability\n"}
              {"• Right to Lodge a Complaint with the NPC"}
            </Text>
            <Text style={styles.body}>
              Requests will be acknowledged within five (5) business days and
              acted upon within thirty (30) days.
            </Text>
            <Text style={styles.sectionTitle}>
              SECTION 9: CONTACT INFORMATION
            </Text>
            <Text style={styles.body}>
              <Text style={styles.bold}>PRIMARY: </Text>PLANTSCOPE Data
              Manager (System Administrator){"\n"}City Environment and Natural
              Resources Office (City ENRO), Ormoc City LGU{"\n"}Email:
              system.admin@plantscope.gov.ph{"\n\n"}
              <Text style={styles.bold}>SECONDARY: </Text>Ormoc City LGU Data
              Protection Officer (DPO){"\n"}Email: dpo@ormoccity.gov.ph{"\n"}
              Office: Ormoc City Hall, A. Bonifacio St., Ormoc City{"\n\n"}
              <Text style={styles.bold}>REGULATORY AUTHORITY: </Text>National
              Privacy Commission (NPC){"\n"}3F Core G Building, GSIS Complex,
              Roxas Blvd., Pasay City{"\n"}Email: info@privacy.gov.ph | Website:
              www.privacy.gov.ph
            </Text>
            <View style={styles.ackBox}>
              <Text style={styles.ackText}>
                <Text style={styles.bold}>ACKNOWLEDGMENT: </Text>By accessing
                or using PLANTSCOPE, you confirm that you have read, understood,
                and agreed to this Data Privacy Notice.
              </Text>
              <Text style={styles.ackSub}>
                PLANTSCOPE | Western Leyte College of Ormoc City | RA 10173
                Compliant
              </Text>
            </View>
            <View style={{ height: 20 }} />
          </ScrollView>

          {!canConfirm && !hasViewed && (
            <View style={styles.scrollHint}>
              <Text style={styles.scrollHintText}>
                📜 Please scroll to the bottom to continue
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.closeBtn, (!canConfirm && !hasViewed) && styles.closeBtnDisabled]}
            onPress={handleConfirm}
            disabled={!canConfirm && !hasViewed}
          >
            <Text style={styles.closeText}>
              {hasViewed ? "Close" : "I Have Read and Understand"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.82)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#183d23",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 20,
    maxHeight: "88%",
    borderTopWidth: 1,
    borderTopColor: "rgba(76,175,114,0.4)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  title: { fontSize: 16, color: "#ffffff", fontWeight: "700", flex: 1 },
  viewedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(76,175,114,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(76,175,114,0.3)",
  },
  viewedText: { color: "#4caf72", fontSize: 10, fontWeight: "700" },
  effective: { fontSize: 11, color: "#5a8a6a", marginBottom: 14 },
  scroll: { flexGrow: 0 },
  sectionTitle: {
    fontSize: 11,
    color: "#4caf72",
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  subHeading: {
    fontSize: 12,
    color: "#e0ece4",
    fontWeight: "700",
    marginTop: 10,
    marginBottom: 4,
  },
  body: { fontSize: 12, color: "#a8c5b3", lineHeight: 19, marginBottom: 4 },
  bold: { fontWeight: "700", color: "#e0ece4" },
  noteText: {
    fontSize: 11,
    color: "#4caf72",
    fontStyle: "italic",
    marginTop: 6,
    marginBottom: 4,
  },
  highlightBox: {
    backgroundColor: "rgba(76,175,114,0.1)",
    borderLeftWidth: 3,
    borderLeftColor: "#4caf72",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
    marginVertical: 8,
  },
  highlightText: {
    fontSize: 12,
    color: "#e0ece4",
    fontStyle: "italic",
    lineHeight: 18,
  },
  ackBox: {
    backgroundColor: "rgba(76,175,114,0.1)",
    borderWidth: 1,
    borderColor: "rgba(76,175,114,0.35)",
    borderRadius: 10,
    padding: 14,
    marginTop: 16,
    marginBottom: 4,
    alignItems: "center",
  },
  ackText: {
    fontSize: 12,
    color: "#e0ece4",
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 4,
  },
  ackSub: { fontSize: 10, color: "#5a8a6a", textAlign: "center" },
  scrollHint: {
    backgroundColor: "rgba(245,158,11,0.1)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.3)",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginVertical: 10,
    alignItems: "center",
  },
  scrollHintText: { color: "#fbbf24", fontSize: 11, fontWeight: "600" },
  closeBtn: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#2d5f3c",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(76,175,114,0.3)",
  },
  closeBtnDisabled: { opacity: 0.4 },
  closeText: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
});