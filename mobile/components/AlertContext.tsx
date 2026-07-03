import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { View, StyleSheet, Platform, Modal } from "react-native";
import CustomToast from "./CustomToast";
import CustomDialog from "./CustomDialog";

type AlertType = "success" | "error" | "warning" | "info";

type ToastMessage = {
  id: string;
  type: AlertType;
  title: string;
  message?: string;
  duration?: number;
};

type DialogMessage = {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
};

type AlertContextType = {
  success: (title: string, message?: string, duration?: number) => void;
  error: (title: string, message?: string, duration?: number) => void;
  warning: (title: string, message?: string, duration?: number) => void;
  info: (title: string, message?: string, duration?: number) => void;
  confirm: (
    title: string,
    message: string,
    onConfirm: () => void | Promise<void>,
    options?: {
      confirmText?: string;
      cancelText?: string;
      type?: AlertType;
      onCancel?: () => void;
    }
  ) => void;
};

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [dialog, setDialog] = useState<DialogMessage | null>(null);
  const idCounter = useRef(0);

  const generateId = () => `alert_${Date.now()}_${idCounter.current++}`;

  const addToast = useCallback((type: AlertType, title: string, message?: string, duration = 3000) => {
    const id = generateId();
    setToasts((prev) => [...prev, { id, type, title, message, duration }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const success = useCallback(
    (title: string, message?: string, duration?: number) => addToast("success", title, message, duration),
    [addToast]
  );

  const error = useCallback(
    (title: string, message?: string, duration?: number) => addToast("error", title, message, duration),
    [addToast]
  );

  const warning = useCallback(
    (title: string, message?: string, duration?: number) => addToast("warning", title, message, duration),
    [addToast]
  );

  const info = useCallback(
    (title: string, message?: string, duration?: number) => addToast("info", title, message, duration),
    [addToast]
  );

  const confirm = useCallback(
    (
      title: string,
      message: string,
      onConfirm: () => void | Promise<void>,
      options?: {
        confirmText?: string;
        cancelText?: string;
        type?: AlertType;
        onCancel?: () => void;
      }
    ) => {
      const id = generateId();
      setDialog({
        id,
        type: options?.type || "warning",
        title,
        message,
        confirmText: options?.confirmText || "Confirm",
        cancelText: options?.cancelText || "Cancel",
        onConfirm,
        onCancel: options?.onCancel,
      });
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const closeDialog = useCallback(() => {
    setDialog(null);
  }, []);

  return (
    <AlertContext.Provider value={{ success, error, warning, info, confirm }}>
      {children}

      {/* Toast Modal - Renders above everything including other modals */}
      <Modal
        transparent
        visible={toasts.length > 0}
        statusBarTranslucent
        animationType="none"
        pointerEvents="box-none"
      >
        <View style={styles.toastModalContainer}>
          {toasts.map((toast, index) => (
            <CustomToast
              key={toast.id}
              toast={toast}
              index={index}
              onClose={() => removeToast(toast.id)}
            />
          ))}
        </View>
      </Modal>

      {/* Dialog */}
      {dialog && <CustomDialog dialog={dialog} onClose={closeDialog} />}
    </AlertContext.Provider>
  );
};

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error("useAlert must be used within an AlertProvider");
  }
  return context;
};

const styles = StyleSheet.create({
  toastModalContainer: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 40,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 16,
  },
});