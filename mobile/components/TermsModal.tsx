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
import { FileText, CheckCircle } from "lucide-react-native";

type TermsModalProps = {
  visible: boolean;
  onClose: () => void;
  onViewed?: () => void;
  hasViewed?: boolean;
};

export default function TermsModal({
  visible,
  onClose,
  onViewed,
  hasViewed = false,
}: TermsModalProps) {
  const [canConfirm, setCanConfirm] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

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
            <FileText size={18} color="#4caf72" />
            <Text style={styles.title}>Terms and Conditions</Text>
            {hasViewed && (
              <View style={styles.viewedBadge}>
                <CheckCircle size={12} color="#4caf72" />
                <Text style={styles.viewedText}>Viewed</Text>
              </View>
            )}
          </View>
          <Text style={styles.effective}>
            Governing access, registration, and use of the PLANTSCOPE System
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
              These Terms and Conditions govern the access, registration, and
              use of <Text style={styles.bold}>PLANTSCOPE</Text> — a GIS-Based
              Site Suitability Assessment and Reforestation Monitoring System
              developed by students of the{" "}
              <Text style={styles.bold}>
                College of ICT and Engineering, Western Leyte College of Ormoc
                City
              </Text>
              , in collaboration with the{" "}
              <Text style={styles.bold}>City ENRO</Text> and{" "}
              <Text style={styles.bold}>CPDO</Text> of Ormoc City.
            </Text>
            <View style={styles.warningBox}>
              <Text style={styles.warningTitle}>
                ⚠️ IMPORTANT – PLEASE READ CAREFULLY
              </Text>
              <Text style={styles.warningText}>
                By registering an account, logging in, or otherwise accessing
                PLANTSCOPE, you acknowledge that you have read, understood, and
                agree to be legally bound by these Terms and Conditions in their
                entirety. If you do not agree, you must immediately discontinue
                use and request account deactivation from the Data Manager.
              </Text>
            </View>
            <Text style={styles.sectionTitle}>
              SECTION 1: SCOPE AND PURPOSE OF SYSTEM USE
            </Text>
            <Text style={styles.subHeading}>1.1 Scope</Text>
            <Text style={styles.body}>
              These Terms apply to all individuals who access, register, or use
              PLANTSCOPE, including:
            </Text>
            <Text style={styles.body}>
              {
                "• City ENRO Head — primary authority for reforestation program oversight\n"
              }
              {
                "• Data Manager (System Administrator) — maintains technical and data integrity\n"
              }
              {
                "• GIS Specialists — perform technical site suitability validation\n"
              }
              {
                "• Onsite Inspectors — collect and submit field assessment data via mobile app\n"
              }
              {
                "• Community Users (Tree Growers) — register for the Public Tree Planting Program"
              }
            </Text>
            <Text style={styles.subHeading}>1.2 Purpose</Text>
            <Text style={styles.body}>
              PLANTSCOPE is designed exclusively to support reforestation site
              assessment, field data collection, reforestation monitoring,
              community engagement, archive data management, and compliance &
              audit functions of Ormoc City.
            </Text>
            <Text style={styles.subHeading}>1.3 Non-Commercial Use</Text>
            <Text style={styles.body}>
              PLANTSCOPE is a non-commercial, government-deployed environmental
              management system. It shall not be used for commercial gain,
              private business operations, or activities outside the
              environmental mandate of the Ormoc City LGU.
            </Text>
            <Text style={styles.sectionTitle}>
              SECTION 2: USER RESPONSIBILITIES AND ACCEPTABLE USE
            </Text>
            <Text style={styles.subHeading}>
              2.1 General Responsibilities of All Users
            </Text>
            <Text style={styles.body}>
              <Text style={styles.bold}>Account Security: </Text>Users are
              solely responsible for maintaining the confidentiality of their
              login credentials. Unauthorized use must be reported immediately
              to the Data Manager.{"\n\n"}
              <Text style={styles.bold}>Accuracy of Information: </Text>All
              data, records, and submissions must be accurate, truthful, and
              complete. Submission of false or misleading information is
              strictly prohibited.{"\n\n"}
              <Text style={styles.bold}>Role Compliance: </Text>Users must
              access and use only the features and data authorized for their
              assigned role.{"\n\n"}
              <Text style={styles.bold}>System Integrity: </Text>Users must
              not perform any action that compromises the integrity,
              availability, or security of the PLANTSCOPE system.{"\n\n"}
              <Text style={styles.bold}>Compliance with Laws: </Text>Users
              must comply with all applicable Philippine laws, including RA
              10173, RA 7160, environmental protection laws, and civil service
              regulations.
            </Text>
            <Text style={styles.subHeading}>
              2.2 Community User / Tree Grower Responsibilities
            </Text>
            <Text style={styles.body}>
              {
                "• Provides accurate registration information including full name, contact details, and group affiliation\n"
              }
              {
                "• Submits genuine and timely progress updates for assigned tree planting sites\n"
              }
              {
                "• Complies with the assigned schedule and site allocation provided by the Data Manager\n"
              }
              {
                "• Notifies the Data Manager of any change in contact information or group status\n"
              }
              {
                "• Responsible for ensuring that participants they represent are aware of these Terms"
              }
            </Text>
            <Text style={styles.sectionTitle}>
              SECTION 3: PROHIBITED ACTIVITIES
            </Text>
            <Text style={styles.body}>
              The following activities are strictly prohibited on PLANTSCOPE.
              Violation may result in immediate account suspension and legal
              action under applicable Philippine laws:
            </Text>
            <Text style={styles.body}>
              {
                "• Unauthorized access to accounts, data records, or system features not authorized for your role\n"
              }
              {
                "• Sharing or transferring login credentials; logging in as another user\n"
              }
              {
                "• Submitting data that is knowingly false, fabricated, or deliberately misleading\n"
              }
              {
                "• Copying, exporting, or transmitting personal data or spatial records to unauthorized individuals\n"
              }
              {
                "• Introducing malicious code, performing denial-of-service attacks, SQL injection, or technical interference\n"
              }
              {
                "• Modifying or deleting any system record without proper authority\n"
              }
              {
                "• Using personal data accessed through PLANTSCOPE for unauthorized purposes\n"
              }
              {
                "• Using PLANTSCOPE for activities beyond its stated environmental management functions"
              }
            </Text>
            <View style={styles.warningBox}>
              <Text style={styles.warningTitle}>⚖️ Legal Warning</Text>
              <Text style={styles.warningText}>
                Violations may constitute criminal offenses under RA 10173 (Data
                Privacy Act), RA 10175 (Cybercrime Prevention Act), RA 3019
                (Anti-Graft), and other applicable Philippine laws.
              </Text>
            </View>
            <Text style={styles.sectionTitle}>
              SECTION 4: DATA OWNERSHIP AND HANDLING
            </Text>
            <Text style={styles.body}>
              All data submitted to, processed by, or generated within
              PLANTSCOPE is the property of the{" "}
              <Text style={styles.bold}>
                Ormoc City Local Government Unit
              </Text>
              , acting through City ENRO and CPDO. Personal data submitted by
              individual users remains subject to the rights of the data subject
              under RA 10173.
            </Text>
            <Text style={styles.body}>
              Personal data shall not be disclosed to private companies,
              commercial entities, or individuals not affiliated with the
              system's official mandate. Spatial data, GIS maps, and site
              records shall not be published or commercialized without prior
              written approval of the CPDO and City ENRO.
            </Text>
            <Text style={styles.sectionTitle}>
              SECTION 5: ACCOUNT MANAGEMENT AND ACCESS CONTROL
            </Text>
            <Text style={styles.body}>
              Community user accounts require submission of a registration
              request through the community portal, subject to review from the
              Data Manager with final approval by the Head.{"\n\n"}Providing
              false registration information is grounds for immediate account
              rejection or termination.
            </Text>
            <Text style={styles.sectionTitle}>
              SECTION 6: LIMITATION OF LIABILITY
            </Text>
            <Text style={styles.body}>
              PLANTSCOPE is provided on an "as-is" and "as-available" basis. The
              development team and Western Leyte College of Ormoc City make no
              warranty that the system will operate without interruption, error,
              or defect at all times.{"\n\n"}The system does not automatically
              verify the accuracy of user-submitted data. The PLANTSCOPE
              development team shall not be liable for decisions made based on
              inaccurate, incomplete, or false data submitted by users.
            </Text>
            <Text style={styles.sectionTitle}>
              SECTION 7: RA 10173 COMPLIANCE
            </Text>
            <Text style={styles.body}>
              PLANTSCOPE is designed and operated in full compliance with
              Republic Act No. 10173 and its IRR, as enforced by the National
              Privacy Commission (NPC) of the Philippines. Key principles
              applied: Transparency, Legitimate Purpose, Proportionality, Data
              Security, Data Subject Rights, Data Retention & Disposal, and
              Breach Notification.
            </Text>
            <Text style={styles.noteText}>
              These Terms must be read in conjunction with the PLANTSCOPE Data
              Privacy Notice. In matters of data privacy, the Data Privacy
              Notice shall prevail.
            </Text>
            <Text style={styles.sectionTitle}>
              SECTION 8: ACCEPTANCE OF TERMS
            </Text>
            <View style={styles.ackBox}>
              <Text style={styles.body}>
                {
                  "1. I have read, understood, and voluntarily agree to comply with all provisions of these Terms and Conditions.\n\n"
                }
                {
                  "2. I have read and understood the PLANTSCOPE Data Privacy Notice and consent to the collection, processing, and use of my personal data as described therein.\n\n"
                }
                {
                  "3. I understand that continued use of PLANTSCOPE after any amendment constitutes my acceptance of the updated Terms.\n\n"
                }
                {
                  "4. I understand that violation of these Terms may result in account suspension, termination, and legal consequences under applicable Philippine law.\n\n"
                }
                {
                  "5. I affirm that all information I provide to the system is accurate, truthful, and complete.\n\n"
                }
                {
                  "6. I acknowledge that PLANTSCOPE is a government-deployed environmental management system and commit to using it exclusively for its stated purposes."
                }
              </Text>
            </View>
            <Text style={styles.sectionTitle}>
              SECTION 9: GOVERNING LAW AND JURISDICTION
            </Text>
            <Text style={styles.body}>
              These Terms and Conditions shall be governed by the laws of the
              Republic of the Philippines, including RA 10173, RA 10175, RA
              7160, RA 3019, and NPC Circulars. Any dispute shall be subject to
              the jurisdiction of the appropriate government agencies and
              courts, with venue in{" "}
              <Text style={styles.bold}>Ormoc City, Leyte</Text>.
            </Text>
            <View style={styles.ackBox}>
              <Text style={styles.ackText}>
                TERMS AND CONDITIONS – END OF DOCUMENT
              </Text>
              <Text style={styles.ackSub}>
                PLANTSCOPE | Western Leyte College of Ormoc City | College of
                ICT and Engineering | RA 10173 Compliant
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
  warningBox: {
    backgroundColor: "rgba(239,68,68,0.1)",
    borderLeftWidth: 3,
    borderLeftColor: "#ef4444",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
    marginVertical: 8,
  },
  warningTitle: {
    fontSize: 12,
    color: "#ffffff",
    fontWeight: "700",
    marginBottom: 4,
  },
  warningText: { fontSize: 11, color: "#a8c5b3", lineHeight: 17 },
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