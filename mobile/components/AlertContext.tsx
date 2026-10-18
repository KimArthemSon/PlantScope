import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { View, StyleSheet, Platform } from "react-native";
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

// Toasts are drawn by <ToastHost /> overlays instead of a native <Modal>,
// because a Modal is a full-screen window that blocks every touch until the
// toast disappears. The provider renders one host over the app; screens that
// open their own <Modal> render another <ToastHost /> inside it so toasts still
// appear on top. Only the most recently mounted host draws, so toasts never
// show twice.
type ToastHostContextType = {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
  activeHostId: number | undefined;
  registerHost: (id: number) => void;
  unregisterHost: (id: number) => void;
};

const ToastHostContext = createContext<ToastHostContextType | undefined>(undefined);
let nextHostId = 0;

export const ToastHost: React.FC = () => {
  const ctx = useContext(ToastHostContext);
  const hostId = useRef(nextHostId++).current;

  useEffect(() => {
    if (!ctx) return;
    ctx.registerHost(hostId);
    return () => ctx.unregisterHost(hostId);
    // register/unregister are stable; run once per host
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ctx || ctx.activeHostId !== hostId || ctx.toasts.length === 0) return null;

  return (
    <View style={styles.toastContainer} pointerEvents="box-none">
      {ctx.toasts.map((toast, index) => (
        <CustomToast
          key={toast.id}
          toast={toast}
          index={index}
          onClose={() => ctx.removeToast(toast.id)}
        />
      ))}
    </View>
  );
};

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [dialog, setDialog] = useState<DialogMessage | null>(null);
  const [hostIds, setHostIds] = useState<number[]>([]);
  const idCounter = useRef(0);

  const registerHost = useCallback((id: number) => {
    setHostIds((prev) => [...prev, id]);
  }, []);
  const unregisterHost = useCallback((id: number) => {
    setHostIds((prev) => prev.filter((h) => h !== id));
  }, []);

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
      <ToastHostContext.Provider
        value={{
          toasts,
          removeToast,
          activeHostId: hostIds[hostIds.length - 1],
          registerHost,
          unregisterHost,
        }}
      >
        {children}

        {/* App-level toast overlay; touches pass through everywhere except the toast itself */}
        <ToastHost />

        {/* Dialog */}
        {dialog && <CustomDialog dialog={dialog} onClose={closeDialog} />}
      </ToastHostContext.Provider>
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
  toastContainer: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 40,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 16,
    zIndex: 9999,
    elevation: 9999, // Android draws by elevation, so keep toasts above screen content
  },
});