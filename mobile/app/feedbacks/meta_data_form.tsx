import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  FlatList,
  Modal,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import NetInfo from "@react-native-community/netinfo";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/constants/url_fixed";
import {
  saveOfflineDraft,
  updateOfflineDraft,
  getOfflineDraft,
  generateLocalUUID,
  OfflineDraft,
  OfflineImage,
} from "@/hooks/useOfflineFieldAssessment";
import { useNetworkStatus } from "@/utils/networkStatus";
import { useAlert } from "@/components/AlertContext";

const API_BASE = api;

/* ---------- STRICT LAYER CODES ---------- */
const DOC_LAYER_CODES = {
  land_title: "meta_land_title",
  tax_decl: "meta_tax_decl",
  other_doc: "meta_other_doc",
};

/* ---------- ✅ GPS-REFACTOR: Constants ---------- */
const GPS_READY_HOURS = 2; // < 2h = warm cache
const GPS_AGING_HOURS = 6; // 2–6h = aging cache
const GPS_LIVE_TIMEOUT_MS = 30000; // 30s timeout for live GPS (Optimal for tree canopy)

/* ---------- TYPES ---------- */
type SecurityConcern =
  | "Armed Threat / Violence"
  | "Hostile Person on Site"
  | "Illegal Activity Observed"
  | "Community Resistance"
  | "Land Conflict"
  | "Other";

type AccessibilityType = "Road" | "Trail" | "None" | "Other";

type GPSReadiness = "ready" | "aging" | "cold" | "checking";

interface LocalDocImage {
  id: string;
  type: keyof typeof DOC_LAYER_CODES;
  uri: string;
  note: string;
}

interface LandClassificationOption {
  land_classification_id: number;
  name: string;
  ownership_type: "public" | "private";
}

interface AnimalOption {
  animal_id: number;
  name: string;
  scientific_name: string;
  description: string;
}

/* ---------- SCREEN ---------- */
export default function MetaDataForm() {
  const { id, areaId, siteId, offlineDraftId } = useLocalSearchParams<{
    id?: string;
    areaId: string;
    siteId?: string;
    offlineDraftId?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { success, error: showError, warning, info, confirm } = useAlert();

  const isEditMode = !!id;
  const isEditingOfflineDraft = !!offlineDraftId;

  const [loading, setLoading] = useState(isEditMode || isEditingOfflineDraft);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [savingOffline, setSavingOffline] = useState(false);
  const [networkChecked, setNetworkChecked] = useState(false);

  /* Form State */
  const [assessmentDate, setAssessmentDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [location, setLocation] = useState<any>(null);
  const [locationLat, setLocationLat] = useState("");
  const [locationLng, setLocationLng] = useState("");
  const [locationAccuracy, setLocationAccuracy] = useState("");
  const [gettingLocation, setGettingLocation] = useState(false);

  // ✅ GPS-REFACTOR: New state for GPS readiness indicator
  const [gpsReadiness, setGpsReadiness] = useState<GPSReadiness>("checking");
  const [gpsReadinessAge, setGpsReadinessAge] = useState<number | null>(null);

  // ✅ GPS-REFACTOR: Countdown state for UI
  const [gpsCountdown, setGpsCountdown] = useState(30);

  const [landTitleNote, setLandTitleNote] = useState("");
  const [taxDeclNote, setTaxDeclNote] = useState("");
  const [landClassId, setLandClassId] = useState<number | null>(null);
  const [landClassNote, setLandClassNote] = useState("");

  const [otherDocs, setOtherDocs] = useState<{ note: string }[]>([]);

  const isOnline = useNetworkStatus();
  const isOfflineMode = !isOnline;

  const [selectedAnimalIds, setSelectedAnimalIds] = useState<number[]>([]);

  const [securitySelected, setSecuritySelected] = useState<SecurityConcern[]>(
    [],
  );
  const [securityNote, setSecurityNote] = useState("");

  const [vehicleAccess, setVehicleAccess] = useState<AccessibilityType[]>([]);
  const [accessNotes, setAccessNotes] = useState("");

  const [landClassifications, setLandClassifications] = useState<
    LandClassificationOption[]
  >([]);
  const [animals, setAnimals] = useState<AnimalOption[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showAnimalModal, setShowAnimalModal] = useState(false);

  const [localImages, setLocalImages] = useState<LocalDocImage[]>([]);
  const [existingImages, setExistingImages] = useState<any[]>([]);

  /* ---------- Direct Network Check on Mount ---------- */
  useEffect(() => {
    const checkNetworkOnMount = async () => {
      try {
        const networkState = await NetInfo.fetch();
        console.log("Network state on mount:", networkState.isConnected);
      } catch (err) {
        console.error("Error checking network:", err);
      } finally {
        setNetworkChecked(true);
      }
    };
    checkNetworkOnMount();
  }, []);

  /* ---------- ✅ GPS-REFACTOR: Check GPS readiness on mount ---------- */
  useEffect(() => {
    if (networkChecked) {
      checkGPSReadiness();
    }
  }, [networkChecked]);

  /* ---------- ✅ GPS-REFACTOR: GPS Readiness Checker ---------- */
  const checkGPSReadiness = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") {
        setGpsReadiness("cold");
        setGpsReadinessAge(null);
        return;
      }

      const lastKnown = await Location.getLastKnownPositionAsync();
      if (!lastKnown) {
        setGpsReadiness("cold");
        setGpsReadinessAge(null);
        return;
      }

      const ageHours = (Date.now() - lastKnown.timestamp) / (1000 * 60 * 60);
      setGpsReadinessAge(ageHours);

      if (ageHours < GPS_READY_HOURS) {
        setGpsReadiness("ready");
      } else if (ageHours < GPS_AGING_HOURS) {
        setGpsReadiness("aging");
      } else {
        setGpsReadiness("cold");
      }
    } catch (err) {
      console.error("Error checking GPS readiness:", err);
      setGpsReadiness("cold");
      setGpsReadinessAge(null);
    }
  };

  /* ---------- Load Dropdown Options ---------- */
  useEffect(() => {
    if (networkChecked && !isOfflineMode) {
      fetchLandClassifications();
      fetchAnimals();
    }
  }, [networkChecked, isOfflineMode]);

  const fetchLandClassifications = async () => {
    try {
      const token = await SecureStore.getItemAsync("token");
      const res = await fetch(
        `${API_BASE}/api/get_land_classifications_list/`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        const data = await res.json();
        setLandClassifications(data.data || []);
      }
    } catch (e) {
      console.error("Error fetching land classifications:", e);
    }
  };

  const fetchAnimals = async () => {
    try {
      const token = await SecureStore.getItemAsync("token");
      const res = await fetch(`${API_BASE}/api/get_animals_list/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAnimals(data || []);
      }
    } catch (e) {
      console.error("Error fetching animals:", e);
    }
  };

  /* ---------- Load Offline Draft ---------- */
  useEffect(() => {
    if (isEditingOfflineDraft) {
      loadOfflineDraftData();
    }
  }, [offlineDraftId]);

  const loadOfflineDraftData = async () => {
    if (!offlineDraftId) return;
    try {
      const draft = await getOfflineDraft(offlineDraftId);
      if (!draft) {
        showError("Error", "Draft not found.");
        router.back();
        return;
      }

      const payload = draft.payload;
      const meta = payload.field_assessment_data?.meta_data || {};

      setAssessmentDate(
        payload.assessment_date || new Date().toISOString().split("T")[0],
      );
      setLocation(payload.location || null);
      if (payload.location) {
        setLocationLat(payload.location.latitude?.toString() || "");
        setLocationLng(payload.location.longitude?.toString() || "");
        setLocationAccuracy(
          payload.location.gps_accuracy_meters?.toString() || "",
        );
      }

      setLandTitleNote(meta.legal_documents?.land_title?.note || "");
      setTaxDeclNote(meta.legal_documents?.tax_declaration?.note || "");
      setLandClassId(payload.land_classification_id || null);
      setLandClassNote(
        meta.legal_documents?.land_classification?.inspector_notes || "",
      );
      setOtherDocs(meta.legal_documents?.other_documents || []);

      if (Array.isArray(payload.animal_ids)) {
        setSelectedAnimalIds(payload.animal_ids);
      }
      setSecuritySelected(meta.security_concerns?.selected || []);
      setSecurityNote(meta.security_concerns?.note || "");

      const accessData = meta.accessibility?.vehicle_access;
      if (Array.isArray(accessData)) {
        setVehicleAccess(accessData);
      } else if (accessData) {
        setVehicleAccess([accessData]);
      }
      setAccessNotes(meta.accessibility?.notes || "");

      if (Array.isArray(draft.images)) {
        const loadedImages: LocalDocImage[] = draft.images.map((img) => {
          let docType: keyof typeof DOC_LAYER_CODES = "other_doc";
          for (const [key, value] of Object.entries(DOC_LAYER_CODES)) {
            if (value === img.layerCode) {
              docType = key as keyof typeof DOC_LAYER_CODES;
              break;
            }
          }
          return {
            id: img.id,
            type: docType,
            uri: img.uri,
            note: img.description || "",
          };
        });
        setLocalImages(loadedImages);
      }
    } catch (e: any) {
      console.error("Error loading offline draft:", e);
      showError("Error", "Failed to load draft.");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  /* ---------- Load Detail (Edit Online Mode) ---------- */
  useEffect(() => {
    if (isEditMode) fetchDetail();
  }, []);

  const fetchDetail = async () => {
    try {
      const token = await SecureStore.getItemAsync("token");
      const res = await fetch(`${API_BASE}/api/field_assessments/${id}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load assessment.");
      const data = await res.json();

      setIsSubmitted(data.is_submitted);
      const meta = data.field_assessment_data?.meta_data || {};

      setAssessmentDate(
        data.assessment_date?.split("T")[0] ||
          new Date().toISOString().split("T")[0],
      );
      setLocation(data.location || null);
      if (data.location) {
        setLocationLat(data.location.latitude?.toString() || "");
        setLocationLng(data.location.longitude?.toString() || "");
        setLocationAccuracy(
          data.location.gps_accuracy_meters?.toString() || "",
        );
      }

      setLandTitleNote(meta.legal_documents?.land_title?.note || "");
      setTaxDeclNote(meta.legal_documents?.tax_declaration?.note || "");
      setLandClassId(
        data.land_classification_id || data.land_classification?.id || null,
      );
      setLandClassNote(
        meta.legal_documents?.land_classification?.inspector_notes || "",
      );
      setOtherDocs(meta.legal_documents?.other_documents || []);

      if (Array.isArray(data.animals_present)) {
        setSelectedAnimalIds(data.animals_present.map((a: any) => a.animal_id));
      }

      setSecuritySelected(meta.security_concerns?.selected || []);
      setSecurityNote(meta.security_concerns?.note || "");

      const accessData = meta.accessibility?.vehicle_access;
      if (Array.isArray(accessData)) {
        setVehicleAccess(accessData);
      } else if (accessData) {
        setVehicleAccess([accessData]);
      }
      setAccessNotes(meta.accessibility?.notes || "");

      if (Array.isArray(data.images)) setExistingImages(data.images);
    } catch (e: any) {
      showError("Error", e.message ?? "Failed to load assessment.");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  /* ---------- ✅ GPS-REFACTOR: Robust Location Handler with 30s Timeout, Countdown + Fallback ---------- */
  const handleGetCurrentLocation = async () => {
    setGettingLocation(true);
    setGpsCountdown(30);

    // Start countdown timer
    const interval = setInterval(() => {
      setGpsCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    try {
      // 1. Check permission first
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        clearInterval(interval);
        warning(
          "Permission Required",
          "Location access is disabled. Please enable it in your device Settings to capture GPS coordinates.",
        );
        setGettingLocation(false);
        return;
      }

      let loc: Location.LocationObject;
      let usedFallback = false;

      // 2. Try live GPS with strict timeout
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error("GPS_TIMEOUT")),
            GPS_LIVE_TIMEOUT_MS,
          );
        });

        loc = await Promise.race([
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
            mayShowUserSettingsDialog: true,
          }),
          timeoutPromise,
        ]);
      } catch (liveErr: any) {
        // 3. Live GPS failed — try last known position as fallback
        console.warn("Live GPS failed, trying fallback:", liveErr.message);
        const lastKnown = await Location.getLastKnownPositionAsync();

        if (!lastKnown) {
          clearInterval(interval);
          // No fallback available — give actionable error
          if (liveErr.message === "GPS_TIMEOUT") {
            showError(
              "GPS Signal Not Found",
              `Could not lock onto GPS after ${GPS_LIVE_TIMEOUT_MS / 1000} seconds. This is common when offline and indoors/under tree canopy. Please:\n\n• Step outside near a window or open area\n• Or enter coordinates manually from your handheld GPS`,
            );
          } else {
            showError(
              "GPS Error",
              "Unable to retrieve location. Please enter coordinates manually.",
            );
          }
          setGettingLocation(false);
          return;
        }

        // Fallback succeeded
        loc = lastKnown;
        usedFallback = true;
      }

      clearInterval(interval);

      // 4. Apply location to state
      setLocationLat(loc.coords.latitude.toFixed(6));
      setLocationLng(loc.coords.longitude.toFixed(6));
      setLocationAccuracy(loc.coords.accuracy?.toFixed(1) || "");
      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        gps_accuracy_meters: loc.coords.accuracy,
      });

      // 5. Show appropriate success/warning message
      if (usedFallback) {
        warning(
          "Using Last Known Location",
          "Live GPS signal unavailable. We've filled in your last known position. Please verify the coordinates or edit them manually for accuracy.",
        );
      } else {
        success("Location Captured", "GPS coordinates updated successfully.");
      }

      // 6. Re-check GPS readiness after successful fix (cache is now warm!)
      checkGPSReadiness();
    } catch (err: any) {
      clearInterval(interval);
      console.error("Unexpected location error:", err);
      showError(
        "Error",
        "Unexpected error getting location. Please try again.",
      );
    } finally {
      setGettingLocation(false);
    }
  };

  /* ---------- Image Helpers (General Photos Only) ---------- */
  const pickGeneralPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      setLocalImages([
        ...localImages,
        {
          id: `local-${Date.now()}`,
          type: "other_doc",
          uri: result.assets[0].uri,
          note: "General field photo",
        },
      ]);
    }
  };

  const deleteExistingImage = (imageId: number) => {
    confirm(
      "Delete Photo",
      "Remove this photo?",
      async () => {
        try {
          const token = await SecureStore.getItemAsync("token");
          const res = await fetch(
            `${API_BASE}/api/field_assessments/images/${imageId}/delete/`,
            {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            },
          );
          if (res.ok) {
            setExistingImages(
              existingImages.filter((i) => i.image_id !== imageId),
            );
            success("Deleted", "Photo removed successfully.");
          } else {
            showError("Error", "Failed to delete.");
          }
        } catch {
          showError("Error", "Network error.");
        }
      },
      { type: "error", confirmText: "Delete", cancelText: "Cancel" },
    );
  };

  const removeLocalImage = (id: string) => {
    setLocalImages(localImages.filter((i) => i.id !== id));
  };

  /* ---------- Toggles ---------- */
  const toggleSecurity = (item: SecurityConcern) => {
    if (item === "Other" && securitySelected.includes("Other")) {
      setSecuritySelected(securitySelected.filter((s) => s !== "Other"));
    } else if (item === "Other") {
      setSecuritySelected([...securitySelected, "Other"]);
    } else {
      setSecuritySelected(
        securitySelected.includes(item)
          ? securitySelected.filter((s) => s !== item)
          : [...securitySelected, item],
      );
    }
  };

  const toggleAccessibility = (item: AccessibilityType) => {
    if (vehicleAccess.includes(item)) {
      setVehicleAccess(vehicleAccess.filter((v) => v !== item));
    } else {
      setVehicleAccess([...vehicleAccess, item]);
    }
  };

  const toggleAnimal = (animalId: number) => {
    if (selectedAnimalIds.includes(animalId)) {
      setSelectedAnimalIds(selectedAnimalIds.filter((id) => id !== animalId));
    } else {
      setSelectedAnimalIds([...selectedAnimalIds, animalId]);
    }
  };

  /* ---------- Build Payload ---------- */
  const buildPayload = () => {
    const locationObj =
      locationLat && locationLng
        ? {
            latitude: parseFloat(locationLat),
            longitude: parseFloat(locationLng),
            gps_accuracy_meters: locationAccuracy
              ? parseFloat(locationAccuracy)
              : undefined,
          }
        : null;

    return {
      reforestation_area_id: parseInt(areaId),
      site_id: siteId ? parseInt(siteId) : null,
      assessment_date: assessmentDate,
      location: locationObj,
      land_classification_id: landClassId,
      animal_ids: selectedAnimalIds,
      field_assessment_data: {
        meta_data: {
          legal_documents: {
            land_title: { note: landTitleNote },
            tax_declaration: { note: taxDeclNote },
            land_classification: { inspector_notes: landClassNote },
            other_documents: otherDocs,
          },
          security_concerns: {
            selected: securitySelected,
            note: securityNote,
          },
          accessibility: {
            vehicle_access: vehicleAccess,
            notes: accessNotes,
          },
        },
      },
    };
  };

  /* ---------- Save Offline ---------- */
  const handleSaveOffline = async (): Promise<string | null> => {
    if (!assessmentDate) {
      warning("Missing Info", "Assessment date is required.");
      return null;
    }

    setSavingOffline(true);
    try {
      const payload = buildPayload();
      const offlineImages: OfflineImage[] = localImages.map((img) => ({
        id: img.id,
        uri: img.uri,
        layerCode: DOC_LAYER_CODES[img.type],
        description: img.note || "General field photo",
        latitude: payload.location?.latitude,
        longitude: payload.location?.longitude,
      }));

      if (isEditingOfflineDraft && offlineDraftId) {
        await updateOfflineDraft(offlineDraftId, {
          payload,
          images: offlineImages,
          status: "pending",
        });
        success(
          "Updated Offline",
          "Draft updated locally. Will sync when online.",
        );
        router.back();
        return offlineDraftId;
      }

      const localUuid = generateLocalUUID();
      const draft: OfflineDraft = {
        local_uuid: localUuid,
        area_id: parseInt(areaId),
        site_id: siteId ? parseInt(siteId) : null,
        layer: "meta_data",
        payload,
        images: offlineImages,
        created_at: new Date().toISOString(),
        status: "pending",
      };

      await saveOfflineDraft(draft);
      setLocalImages([]);
      success(
        "Saved Offline",
        "Assessment saved locally. Will sync when online.",
      );
      router.back();
      return localUuid;
    } catch (e: any) {
      console.error("Error saving offline:", e);
      showError("Error", "Failed to save offline. Please try again.");
      return null;
    } finally {
      setSavingOffline(false);
    }
  };

  /* ---------- Save Draft (Online) ---------- */
  const handleSaveDraft = async (): Promise<number | null> => {
    if (!assessmentDate) {
      warning("Missing Info", "Assessment date is required.");
      return null;
    }
    setSaving(true);
    try {
      const token = await SecureStore.getItemAsync("token");
      const payload = buildPayload();

      const url = isEditMode
        ? `${API_BASE}/api/field_assessments/${id}/update/`
        : `${API_BASE}/api/field_assessments/create/`;

      let res;
      if (localImages.length > 0) {
        const fd = new FormData();
        fd.append(
          "reforestation_area_id",
          payload.reforestation_area_id.toString(),
        );
        fd.append("site_id", payload.site_id?.toString() || "");
        fd.append("assessment_date", payload.assessment_date);
        fd.append("location", JSON.stringify(payload.location));
        fd.append(
          "land_classification_id",
          payload.land_classification_id?.toString() || "",
        );
        fd.append("animal_ids", JSON.stringify(payload.animal_ids));
        fd.append(
          "field_assessment_data",
          JSON.stringify(payload.field_assessment_data),
        );

        localImages.forEach((img) => {
          fd.append("images", {
            uri: img.uri,
            type: "image/jpeg",
            name: `meta_${Date.now()}_${img.type}.jpg`,
          } as any);
        });

        const imageMetadata = localImages.map((img) => ({
          layer: DOC_LAYER_CODES[img.type],
          description: img.note || "General field photo",
          latitude: payload.location?.latitude || 11.0,
          longitude: payload.location?.longitude || 124.6,
        }));
        fd.append("image_metadata", JSON.stringify(imageMetadata));

        res = await fetch(url, {
          method: isEditMode ? "PUT" : "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
      } else {
        res = await fetch(url, {
          method: isEditMode ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error ?? "Failed to save.");
      }
      const responseData = await res.json();
      const faid = isEditMode
        ? parseInt(id!)
        : responseData.field_assessment_id;

      setLocalImages([]);
      success("Saved", isEditMode ? "Draft updated." : "Draft saved.");
      return faid;
    } catch (e: any) {
      showError("Error", e.message);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    const savedId = await handleSaveDraft();
    if (!savedId) return;

    confirm(
      "Finalize Meta Data",
      "Once submitted, this cannot be edited. Proceed?",
      async () => {
        setSubmitting(true);
        try {
          const token = await SecureStore.getItemAsync("token");
          const res = await fetch(
            `${API_BASE}/api/field_assessments/${savedId}/submit/`,
            {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
            },
          );
          if (!res.ok) {
            const e = await res.json();
            throw new Error(e.error ?? "Failed to submit.");
          }
          success("Submitted", "Meta Data submitted to GIS Specialist!");
          router.back();
        } catch (e: any) {
          showError("Error", e.message);
        } finally {
          setSubmitting(false);
        }
      },
      { type: "warning", confirmText: "Yes, Submit", cancelText: "Cancel" },
    );
  };

  if (!networkChecked || loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#0F4A2F" />
        <Text style={styles.loadingText}>
          {!networkChecked ? "Checking connection…" : "Loading…"}
        </Text>
      </View>
    );
  }

  const isReadOnly = isSubmitted;
  const allImages = [
    ...existingImages.map((img) => ({
      id: img.image_id,
      url: img.url,
      caption: img.description || img.caption,
      isLocal: false,
    })),
    ...localImages.map((img) => ({
      id: img.id,
      url: img.uri,
      caption: img.note || "Untitled",
      isLocal: true,
    })),
  ];

  const getBaseTitle = () => {
    if (isEditingOfflineDraft) return "Edit Offline Draft";
    if (isEditMode) return "Edit Meta Data";
    return "New Meta Data";
  };

  const baseTitle = getBaseTitle();
  const headerTitle = siteId ? `${baseTitle} (Site)` : `${baseTitle} (Area)`;

  const selectedLandClass = landClassifications.find(
    (lc) => lc.land_classification_id === landClassId,
  );
  const selectedLandClassName =
    selectedLandClass?.name || "Select classification";
  const selectedLandClassOwnership = selectedLandClass?.ownership_type || null;

  /* ---------- ✅ GPS-REFACTOR: Helper to format readiness age ---------- */
  const formatReadinessAge = () => {
    if (gpsReadinessAge === null) return "never";
    if (gpsReadinessAge < 1 / 60) return "just now";
    if (gpsReadinessAge < 1)
      return `${Math.round(gpsReadinessAge * 60)} min ago`;
    if (gpsReadinessAge < 24) return `${gpsReadinessAge.toFixed(1)}h ago`;
    return `${Math.round(gpsReadinessAge / 24)}d ago`;
  };

  /* ---------- UI ---------- */
  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
          <Text style={styles.headerSub}>
            {isReadOnly ? "View only" : "Complete all sections"}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {isOfflineMode && !isReadOnly && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={16} color="#FFFFFF" />
          <Text style={styles.offlineBannerText}>
            Offline Mode - Save Offline to sync later
          </Text>
        </View>
      )}

      {/* ✅ GPS-REFACTOR: GPS Readiness Banner */}
      {!isReadOnly && gpsReadiness !== "checking" && (
        <GPSReadinessBanner
          readiness={gpsReadiness}
          ageText={formatReadinessAge()}
          onRefresh={checkGPSReadiness}
        />
      )}

      {isReadOnly && (
        <View style={styles.submittedBanner}>
          <Ionicons name="checkmark-circle" size={18} color="#15803D" />
          <Text style={styles.submittedBannerText}>
            Submitted — awaiting review. Record locked.
          </Text>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* 1. Legal Documents */}
        <SectionCard
          icon="file-document-outline"
          title="Legal Documents"
          sub="Record document details and notes"
        >
          <FieldLabel
            label="Land Classification"
            hint="Official designation per DENR/CENRO records"
          />
          {!isReadOnly ? (
            isOfflineMode ? (
              <View style={styles.offlineFieldNotice}>
                <Ionicons
                  name="cloud-offline-outline"
                  size={14}
                  color="#F59E0B"
                />
                <Text style={styles.offlineFieldText}>
                  Dropdown not available offline. Add note instead.
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.dropdown}
                onPress={() => setShowDropdown(true)}
              >
                <MaterialCommunityIcons
                  name="tag-outline"
                  size={16}
                  color="#0F4A2F"
                />
                <Text style={styles.dropdownText}>{selectedLandClassName}</Text>
                <Ionicons name="chevron-down" size={16} color="#6B7280" />
              </TouchableOpacity>
            )
          ) : (
            <Text style={styles.readonlyText}>{selectedLandClassName}</Text>
          )}

          {!isReadOnly && (
            <TextInput
              style={styles.textArea}
              placeholder="Inspector Notes (e.g., specific classification details)"
              placeholderTextColor="#9CA3AF"
              value={landClassNote}
              onChangeText={setLandClassNote}
              multiline
            />
          )}
          {isReadOnly && landClassNote ? (
            <Text style={styles.readonlyNote}>{landClassNote}</Text>
          ) : null}

          {landClassId ? (
            selectedLandClassOwnership === "private" ? (
              <View style={styles.privateDocsContainer}>
                <FieldLabel label="Land Title Note" optional />
                {!isReadOnly && (
                  <TextInput
                    style={styles.textArea}
                    placeholder="e.g., TCT No. 12345, Registered under Juan Dela Cruz"
                    placeholderTextColor="#9CA3AF"
                    value={landTitleNote}
                    onChangeText={setLandTitleNote}
                    multiline
                  />
                )}
                {isReadOnly && landTitleNote ? (
                  <Text style={styles.readonlyNote}>{landTitleNote}</Text>
                ) : null}

                <FieldLabel label="Tax Declaration Note" optional />
                {!isReadOnly && (
                  <TextInput
                    style={styles.textArea}
                    placeholder="e.g., TD No. 67890, Current Year"
                    placeholderTextColor="#9CA3AF"
                    value={taxDeclNote}
                    onChangeText={setTaxDeclNote}
                    multiline
                  />
                )}
                {isReadOnly && taxDeclNote ? (
                  <Text style={styles.readonlyNote}>{taxDeclNote}</Text>
                ) : null}

                <FieldLabel label="Other Documents" optional />
                {otherDocs.map((doc, idx) => (
                  <View key={idx} style={styles.otherDocRow}>
                    <View style={{ flex: 1 }}>
                      <TextInput
                        style={styles.miniInput}
                        placeholder="Document Name / Note"
                        placeholderTextColor="#9CA3AF"
                        value={doc.note}
                        onChangeText={(val) => {
                          const updated = [...otherDocs];
                          updated[idx].note = val;
                          setOtherDocs(updated);
                        }}
                        editable={!isReadOnly}
                      />
                    </View>
                    {!isReadOnly && (
                      <TouchableOpacity
                        style={styles.miniPickBtn}
                        onPress={() => {
                          const updated = [...otherDocs];
                          updated.splice(idx, 1);
                          setOtherDocs(updated);
                        }}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={16}
                          color="#EF4444"
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                {!isReadOnly && (
                  <TouchableOpacity
                    style={styles.addBtn}
                    onPress={() => setOtherDocs([...otherDocs, { note: "" }])}
                  >
                    <Ionicons name="add" size={16} color="#0F4A2F" />
                    <Text style={styles.addBtnText}>
                      Add Other Document Note
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.publicDocsNotice}>
                <MaterialCommunityIcons
                  name="land-rows"
                  size={20}
                  color="#0F4A2F"
                />
                <Text style={styles.publicDocsNoticeText}>
                  Legal documents are not required for public/government-owned
                  land.
                </Text>
              </View>
            )
          ) : (
            <View style={styles.selectFirstNotice}>
              <Ionicons
                name="information-circle-outline"
                size={16}
                color="#6B7280"
              />
              <Text style={styles.selectFirstText}>
                Please select a land classification first to determine document
                requirements.
              </Text>
            </View>
          )}
        </SectionCard>

        {/* 2. Animal Presence */}
        <SectionCard
          icon="paw-outline"
          title="Animal Presence"
          sub="Select observed animals"
        >
          {!isReadOnly && isOfflineMode ? (
            <View style={styles.offlineFieldNotice}>
              <Ionicons
                name="cloud-offline-outline"
                size={14}
                color="#F59E0B"
              />
              <Text style={styles.offlineFieldText}>
                Animal selection not available offline. Add note instead.
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.animalSelectorBtn}
              onPress={() => !isReadOnly && setShowAnimalModal(true)}
              disabled={isReadOnly}
            >
              <MaterialCommunityIcons name="paw" size={18} color="#0F4A2F" />
              <Text style={styles.animalSelectorText}>
                {selectedAnimalIds.length > 0
                  ? `${selectedAnimalIds.length} animal${selectedAnimalIds.length > 1 ? "s" : ""} selected`
                  : "Tap to select animals"}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#6B7280" />
            </TouchableOpacity>
          )}
          {selectedAnimalIds.length > 0 && (
            <View style={styles.selectedAnimalsList}>
              {selectedAnimalIds.map((animalId) => {
                const animal = animals.find((a) => a.animal_id === animalId);
                if (!animal) return null;
                return (
                  <View key={animalId} style={styles.selectedAnimalChip}>
                    <Text style={styles.selectedAnimalText}>{animal.name}</Text>
                    {!isReadOnly && (
                      <TouchableOpacity onPress={() => toggleAnimal(animalId)}>
                        <Ionicons
                          name="close-circle"
                          size={14}
                          color="#EF4444"
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </SectionCard>

        {/* 3. Security Concerns */}
        <SectionCard
          icon="shield-alert-outline"
          title="Security Concerns"
          sub="Tap all that apply"
        >
          {(
            [
              "Armed Threat / Violence",
              "Hostile Person on Site",
              "Illegal Activity Observed",
              "Community Resistance",
              "Land Conflict",
              "Other",
            ] as SecurityConcern[]
          ).map((s) => (
            <SecurityChip
              key={s}
              label={s}
              active={securitySelected.includes(s)}
              onToggle={() => !isReadOnly && toggleSecurity(s)}
              isReadOnly={isReadOnly}
            />
          ))}
          {securitySelected.length > 0 && !isReadOnly && (
            <TextInput
              style={styles.textArea}
              placeholder="Add security notes (optional)"
              placeholderTextColor="#9CA3AF"
              value={securityNote}
              onChangeText={setSecurityNote}
              multiline
            />
          )}
          {isReadOnly && securityNote ? (
            <Text style={styles.readonlyNote}>{securityNote}</Text>
          ) : null}
        </SectionCard>

        {/* 4. Accessibility (MULTISELECT) */}
        <SectionCard
          icon="car-outline"
          title="Accessibility"
          sub="How to reach the site (select all that apply)"
        >
          <View style={styles.chipGrid}>
            {(["Road", "Trail", "None", "Other"] as AccessibilityType[]).map(
              (opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.chip,
                    vehicleAccess.includes(opt) && {
                      backgroundColor: "#0F4A2F",
                      borderColor: "#0F4A2F",
                    },
                  ]}
                  onPress={() => !isReadOnly && toggleAccessibility(opt)}
                  disabled={isReadOnly}
                >
                  <Text
                    style={[
                      styles.chipText,
                      vehicleAccess.includes(opt) && styles.chipTextActive,
                    ]}
                  >
                    {opt}
                  </Text>
                </TouchableOpacity>
              ),
            )}
          </View>
          {(vehicleAccess.includes("Other") ||
            vehicleAccess.includes("None")) &&
            !isReadOnly && (
              <TextInput
                style={styles.textArea}
                placeholder="Describe how to get there / explain road conditions"
                placeholderTextColor="#9CA3AF"
                value={accessNotes}
                onChangeText={setAccessNotes}
                multiline
              />
            )}
          {isReadOnly && accessNotes ? (
            <Text style={styles.readonlyNote}>{accessNotes}</Text>
          ) : null}
        </SectionCard>

        {/* 5. Assessment Location */}
        <SectionCard
          icon="location-outline"
          title="Assessment Location"
          sub="Your GPS position during this assessment"
        >
          <View style={styles.coordRow}>
            <View style={styles.coordHalf}>
              <FieldLabel label="Latitude" optional />
              <View
                style={[styles.inputRow, isReadOnly && styles.disabledInput]}
              >
                <Ionicons name="navigate-outline" size={13} color="#94A3B8" />
                <TextInput
                  style={styles.inputField}
                  keyboardType="decimal-pad"
                  value={locationLat}
                  onChangeText={setLocationLat}
                  placeholder="e.g. 11.0"
                  placeholderTextColor="#94A3B8"
                  editable={!isReadOnly}
                />
              </View>
            </View>
            <View style={styles.coordHalf}>
              <FieldLabel label="Longitude" optional />
              <View
                style={[styles.inputRow, isReadOnly && styles.disabledInput]}
              >
                <Ionicons name="navigate-outline" size={13} color="#94A3B8" />
                <TextInput
                  style={styles.inputField}
                  keyboardType="decimal-pad"
                  value={locationLng}
                  onChangeText={setLocationLng}
                  placeholder="e.g. 124.6"
                  placeholderTextColor="#94A3B8"
                  editable={!isReadOnly}
                />
              </View>
            </View>
          </View>
          <FieldLabel label="GPS Accuracy (meters)" optional />
          <View style={[styles.inputRow, isReadOnly && styles.disabledInput]}>
            <MaterialCommunityIcons
              name="signal-distance-variant"
              size={15}
              color="#94A3B8"
            />
            <TextInput
              style={styles.inputField}
              keyboardType="numeric"
              value={locationAccuracy}
              onChangeText={setLocationAccuracy}
              placeholder="e.g. 3.5"
              placeholderTextColor="#94A3B8"
              editable={!isReadOnly}
            />
          </View>
          {!isReadOnly && (
            <TouchableOpacity
              style={[styles.gpsBtn, gettingLocation && styles.gpsBtnLoading]}
              onPress={handleGetCurrentLocation}
              disabled={gettingLocation}
              activeOpacity={0.8}
            >
              {gettingLocation ? (
                <>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.gpsBtnText}>
                    Acquiring GPS ({gpsCountdown}s)…
                  </Text>
                </>
              ) : (
                <>
                  <MaterialCommunityIcons
                    name="crosshairs-gps"
                    size={16}
                    color="#fff"
                  />
                  <Text style={styles.gpsBtnText}>Use Current Location</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          {locationLat !== "" && locationLng !== "" && (
            <View style={styles.coordPreview}>
              <Ionicons name="location" size={13} color="#0F4A2F" />
              <Text style={styles.coordPreviewText}>
                {locationLat}, {locationLng}
                {locationAccuracy ? `  ±${locationAccuracy}m` : ""}
              </Text>
            </View>
          )}
        </SectionCard>

        {/* 6. Photos & Attachments */}
        <SectionCard
          icon="image-multiple-outline"
          title="Field Photos"
          sub="All uploaded evidence"
        >
          <FlatList
            horizontal
            data={allImages}
            keyExtractor={(i) => i.id.toString()}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 10, gap: 10 }}
            renderItem={({ item }) => (
              <View style={styles.photoCard}>
                <Image
                  source={{ uri: item.url || undefined }}
                  style={styles.photoThumb}
                />
                <Text style={styles.photoCaption} numberOfLines={1}>
                  {item.caption}
                </Text>
                {!isReadOnly && (
                  <TouchableOpacity
                    style={styles.photoDelete}
                    onPress={() =>
                      item.isLocal
                        ? removeLocalImage(item.id as string)
                        : deleteExistingImage(item.id as number)
                    }
                  >
                    <Ionicons name="close" size={12} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
              </View>
            )}
          />
          {!isReadOnly && (
            <TouchableOpacity
              style={styles.addPhotoBtn}
              onPress={pickGeneralPhoto}
            >
              <Ionicons name="camera-outline" size={18} color="#0F4A2F" />
              <Text style={styles.addPhotoBtnText}>Add General Photo</Text>
            </TouchableOpacity>
          )}
        </SectionCard>

        {/* Actions */}
        {!isReadOnly && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[
                styles.offlineBtn,
                (savingOffline || saving) && styles.btnDisabled,
              ]}
              onPress={handleSaveOffline}
              disabled={savingOffline || saving}
            >
              {savingOffline ? (
                <ActivityIndicator size="small" color="#F59E0B" />
              ) : (
                <Ionicons
                  name="cloud-download-outline"
                  size={16}
                  color="#F59E0B"
                />
              )}
              <Text style={styles.offlineBtnText}>
                {savingOffline
                  ? "Saving…"
                  : isEditingOfflineDraft
                    ? "Update Offline Draft"
                    : "Save Offline"}
              </Text>
            </TouchableOpacity>

            {!isOfflineMode && (
              <TouchableOpacity
                style={[styles.draftBtn, saving && styles.btnDisabled]}
                onPress={handleSaveDraft}
                disabled={saving || savingOffline}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#0F4A2F" />
                ) : (
                  <Ionicons name="save-outline" size={16} color="#0F4A2F" />
                )}
                <Text style={styles.draftBtnText}>
                  {saving ? "Saving…" : "Save Draft"}
                </Text>
              </TouchableOpacity>
            )}

            {!isOfflineMode && (
              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.btnDisabled]}
                onPress={handleSubmit}
                disabled={submitting || saving || savingOffline}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="send-outline" size={16} color="#FFFFFF" />
                )}
                <Text style={styles.submitBtnText}>
                  {submitting ? "Submitting…" : "Submit to GIS"}
                </Text>
              </TouchableOpacity>
            )}

            {isOfflineMode && (
              <View style={styles.offlineNotice}>
                <Ionicons name="information-circle" size={16} color="#F59E0B" />
                <Text style={styles.offlineNoticeText}>
                  You're offline. Save offline to sync later.
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Land Classification Dropdown Modal */}
      <Modal visible={showDropdown} transparent animationType="fade">
        <View style={modalStyles.overlay}>
          <View style={modalStyles.modal}>
            <Text style={modalStyles.title}>Select Land Classification</Text>
            <ScrollView style={modalStyles.list}>
              {landClassifications.map((lc) => (
                <TouchableOpacity
                  key={lc.land_classification_id}
                  style={[
                    modalStyles.listItem,
                    landClassId === lc.land_classification_id &&
                      modalStyles.listItemActive,
                  ]}
                  onPress={() => {
                    setLandClassId(lc.land_classification_id);
                    setShowDropdown(false);
                  }}
                >
                  <Text
                    style={[
                      modalStyles.listItemText,
                      landClassId === lc.land_classification_id &&
                        modalStyles.listItemTextActive,
                    ]}
                  >
                    {lc.name}{" "}
                    {lc.ownership_type === "public" ? "(Public)" : "(Private)"}
                  </Text>
                  {landClassId === lc.land_classification_id && (
                    <Ionicons name="checkmark" size={18} color="#0F4A2F" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={modalStyles.cancelBtn}
              onPress={() => setShowDropdown(false)}
            >
              <Text style={modalStyles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Animal Selector Modal */}
      <Modal visible={showAnimalModal} transparent animationType="slide">
        <View style={modalStyles.overlay}>
          <View style={[modalStyles.modal, { maxHeight: "80%" }]}>
            <Text style={modalStyles.title}>Select Animals Observed</Text>
            <Text style={modalStyles.subtitle}>Tap to select/deselect</Text>
            <ScrollView style={modalStyles.list}>
              {animals.map((animal) => (
                <TouchableOpacity
                  key={animal.animal_id}
                  style={[
                    modalStyles.listItem,
                    selectedAnimalIds.includes(animal.animal_id) &&
                      modalStyles.listItemActive,
                  ]}
                  onPress={() => toggleAnimal(animal.animal_id)}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        modalStyles.listItemText,
                        selectedAnimalIds.includes(animal.animal_id) &&
                          modalStyles.listItemTextActive,
                      ]}
                    >
                      {animal.name}
                    </Text>
                    {animal.scientific_name ? (
                      <Text style={modalStyles.listItemSubtext}>
                        {animal.scientific_name}
                      </Text>
                    ) : null}
                  </View>
                  {selectedAnimalIds.includes(animal.animal_id) && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#0F4A2F"
                    />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={modalStyles.cancelBtn}
              onPress={() => setShowAnimalModal(false)}
            >
              <Text style={modalStyles.cancelBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ---------- ✅ GPS-REFACTOR: GPS Readiness Banner Component ---------- */
const GPSReadinessBanner: React.FC<{
  readiness: GPSReadiness;
  ageText: string;
  onRefresh: () => void;
}> = ({ readiness, ageText, onRefresh }) => {
  const config = {
    ready: {
      bg: "#DCFCE7",
      border: "#86EFAC",
      icon: "checkmark-circle" as const,
      iconColor: "#15803D",
      title: "GPS Ready",
      titleColor: "#15803D",
      message: `Last fix: ${ageText}. Safe to go offline.`,
    },
    aging: {
      bg: "#FEF3C7",
      border: "#FCD34D",
      icon: "time-outline" as const,
      iconColor: "#92400E",
      title: "GPS Cache Aging",
      titleColor: "#92400E",
      message: `Last fix: ${ageText}. Consider brief internet to warm up.`,
    },
    cold: {
      bg: "#FEE2E2",
      border: "#FCA5A5",
      icon: "snow-outline" as const,
      iconColor: "#991B1B",
      title: "GPS Cold",
      titleColor: "#991B1B",
      message: "No recent fix. Connect to internet briefly before field work.",
    },
  };

  const c = config[readiness];

  return (
    <View
      style={[
        styles.gpsBanner,
        { backgroundColor: c.bg, borderColor: c.border },
      ]}
    >
      <Ionicons name={c.icon} size={18} color={c.iconColor} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.gpsBannerTitle, { color: c.titleColor }]}>
          {c.title}
        </Text>
        <Text style={[styles.gpsBannerMessage, { color: c.titleColor }]}>
          {c.message}
        </Text>
      </View>
      <TouchableOpacity onPress={onRefresh} style={styles.gpsBannerRefresh}>
        <Ionicons name="refresh-outline" size={18} color={c.iconColor} />
      </TouchableOpacity>
    </View>
  );
};

/* ---------- SUB-COMPONENTS ---------- */
const SectionCard: React.FC<{
  icon: string;
  title: string;
  sub: string;
  children: React.ReactNode;
}> = ({ icon, title, sub, children }) => (
  <View style={styles.card}>
    <View style={styles.cardHeader}>
      <View style={styles.cardIconWrap}>
        <MaterialCommunityIcons name={icon as any} size={17} color="#0F4A2F" />
      </View>
      <View>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSub}>{sub}</Text>
      </View>
    </View>
    <View style={styles.cardBody}>{children}</View>
  </View>
);

const FieldLabel: React.FC<{
  label: string;
  hint?: string;
  optional?: boolean;
}> = ({ label, hint, optional }) => (
  <View style={{ marginTop: 14, marginBottom: 6 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {optional && <Text style={styles.optionalTag}>optional</Text>}
    </View>
    {hint && <Text style={styles.fieldHint}>{hint}</Text>}
  </View>
);

const SecurityChip: React.FC<{
  label: string;
  active: boolean;
  onToggle: () => void;
  isReadOnly: boolean;
}> = ({ label, active, onToggle, isReadOnly }) => (
  <TouchableOpacity
    style={[styles.secChip, active && styles.secChipActive]}
    onPress={isReadOnly ? undefined : onToggle}
    disabled={isReadOnly}
  >
    <View
      style={[
        styles.secDot,
        { backgroundColor: active ? "#EF4444" : "#9CA3AF" },
      ]}
    />
    <Text style={[styles.secText, active && styles.secTextActive]}>
      {label}
    </Text>
  </TouchableOpacity>
);

/* ---------- STYLES ---------- */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F4F7F5" },
  loadingScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: { color: "#6B7280", fontSize: 14 },
  header: {
    backgroundColor: "#0F4A2F",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
  headerSub: { fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 1 },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F59E0B",
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  offlineBannerText: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },
  submittedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#BBF7D0",
  },
  submittedBannerText: {
    flex: 1,
    fontSize: 12,
    color: "#15803D",
    fontWeight: "600",
  },
  // ✅ GPS-REFACTOR: GPS Readiness Banner styles
  gpsBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  gpsBannerTitle: { fontSize: 12, fontWeight: "700" },
  gpsBannerMessage: { fontSize: 11, marginTop: 1, opacity: 0.85 },
  gpsBannerRefresh: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.05)",
    justifyContent: "center",
    alignItems: "center",
  },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 0 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    marginBottom: 14,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  cardIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#E6F4EC",
    justifyContent: "center",
    alignItems: "center",
  },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#0F2D1C" },
  cardSub: { fontSize: 11, color: "#9CA3AF", marginTop: 1 },
  cardBody: { padding: 14 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fieldHint: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 2,
    fontStyle: "italic",
  },
  optionalTag: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "500",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  textArea: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    color: "#0F2D1C",
    height: 70,
    textAlignVertical: "top",
    marginTop: 6,
  },
  readonlyNote: {
    fontSize: 13,
    color: "#4B5563",
    marginTop: 6,
    backgroundColor: "#F3F4F6",
    padding: 10,
    borderRadius: 8,
  },
  readonlyText: { fontSize: 13, color: "#4B5563", marginTop: 6 },
  dropdown: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 6,
  },
  dropdownText: { flex: 1, fontSize: 13, color: "#0F2D1C" },
  offlineFieldNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF3C7",
    padding: 10,
    borderRadius: 8,
    marginTop: 6,
  },
  offlineFieldText: {
    flex: 1,
    fontSize: 11,
    color: "#92400E",
    fontWeight: "500",
  },
  animalSelectorBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  animalSelectorText: {
    flex: 1,
    fontSize: 13,
    color: "#0F4A2F",
    fontWeight: "600",
  },
  selectedAnimalsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  selectedAnimalChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E6F4EC",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  selectedAnimalText: { fontSize: 11, color: "#0F4A2F", fontWeight: "600" },

  privateDocsContainer: { marginTop: 16 },
  publicDocsNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F0FDF4",
    padding: 14,
    borderRadius: 10,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  publicDocsNoticeText: {
    flex: 1,
    fontSize: 13,
    color: "#15803D",
    fontWeight: "500",
  },
  selectFirstNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F9FAFB",
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
  },
  selectFirstText: { flex: 1, fontSize: 12, color: "#6B7280" },

  otherDocRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  miniInput: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
  },
  miniPickBtn: { padding: 8, backgroundColor: "#FEF2F2", borderRadius: 8 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#0F4A2F",
    borderStyle: "dashed",
    borderRadius: 8,
  },
  addBtnText: { fontSize: 12, fontWeight: "600", color: "#0F4A2F" },
  secChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F9FAFB",
  },
  secChipActive: { backgroundColor: "#FEF2F2" },
  secDot: { width: 10, height: 10, borderRadius: 5 },
  secText: { flex: 1, fontSize: 13, color: "#6B7280" },
  secTextActive: { color: "#0F2D1C", fontWeight: "600" },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    backgroundColor: "#F9FAFB",
    borderColor: "#E5E7EB",
  },
  chipText: { fontSize: 12, color: "#6B7280" },
  chipTextActive: { color: "#FFFFFF", fontWeight: "700" },
  coordRow: { flexDirection: "row", gap: 10 },
  coordHalf: { flex: 1 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputField: { flex: 1, fontSize: 14, color: "#1E293B", padding: 0 },
  disabledInput: {
    backgroundColor: "#F1F5F9",
    borderColor: "#E2E8F0",
    opacity: 0.7,
  },
  coordPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F0FDF4",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    marginTop: 10,
  },
  coordPreviewText: {
    fontSize: 12,
    color: "#166534",
    fontWeight: "600",
    flex: 1,
  },
  gpsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F4A2F",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 8,
    marginTop: 10,
  },
  gpsBtnLoading: { opacity: 0.8 },
  gpsBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  photoCard: { width: 100, position: "relative" },
  photoThumb: {
    width: 100,
    height: 75,
    borderRadius: 10,
    backgroundColor: "#E5E7EB",
    marginBottom: 4,
  },
  photoCaption: { fontSize: 10, color: "#6B7280", textAlign: "center" },
  photoDelete: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(239,68,68,0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  addPhotoBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: "#0F4A2F",
    borderStyle: "dashed",
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 8,
  },
  addPhotoBtnText: { fontSize: 13, fontWeight: "600", color: "#0F4A2F" },
  actions: { gap: 10, marginTop: 4 },
  offlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: "#F59E0B",
    borderRadius: 14,
    paddingVertical: 14,
    backgroundColor: "#FFFBEB",
  },
  offlineBtnText: { fontSize: 14, fontWeight: "700", color: "#F59E0B" },
  draftBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: "#0F4A2F",
    borderRadius: 14,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
  },
  draftBtnText: { fontSize: 14, fontWeight: "700", color: "#0F4A2F" },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#0F4A2F",
    borderRadius: 14,
    paddingVertical: 14,
    elevation: 3,
    shadowColor: "#0F4A2F",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  submitBtnText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
  btnDisabled: { opacity: 0.55 },
  offlineNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF3C7",
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  offlineNoticeText: {
    flex: 1,
    fontSize: 12,
    color: "#92400E",
    fontWeight: "600",
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modal: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  title: { fontSize: 16, fontWeight: "700", color: "#0F2D1C", marginBottom: 4 },
  subtitle: { fontSize: 12, color: "#6B7280", marginBottom: 16 },
  list: { maxHeight: 400, marginBottom: 16 },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  listItemActive: { backgroundColor: "#F0FDF4" },
  listItemText: { fontSize: 14, color: "#0F2D1C" },
  listItemTextActive: { fontWeight: "700", color: "#0F4A2F" },
  listItemSubtext: {
    fontSize: 11,
    color: "#6B7280",
    fontStyle: "italic",
    marginTop: 2,
  },
  cancelBtn: { paddingVertical: 10, alignItems: "center" },
  cancelBtnText: { color: "#0F4A2F", fontWeight: "700", fontSize: 14 },
});
