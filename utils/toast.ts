import { toast } from "sonner";

/**
 * Toasts unifiés pour toute l'app — cohérence visuelle garantie.
 * Position bottom-right, durées par défaut, descriptions optionnelles.
 */

const DEFAULT_DURATION = 4000;

export const showSuccess = (message: string, description?: string) => {
  toast.success(message, {
    description,
    duration: DEFAULT_DURATION,
  });
};

export const showError = (message: string, description?: string) => {
  toast.error(message, {
    description,
    duration: DEFAULT_DURATION + 1000,
  });
};

export const showInfo = (message: string, description?: string) => {
  toast.info(message, {
    description,
    duration: DEFAULT_DURATION,
  });
};

export const showWarning = (message: string, description?: string) => {
  toast.warning(message, {
    description,
    duration: DEFAULT_DURATION,
  });
};

export const showLoading = (message: string) => {
  return toast.loading(message);
};

export const dismissToast = (id: string | number) => {
  toast.dismiss(id);
};
