const otpStore = new Map<string, { otp: string; expiresAt: number }>();
const OTP_TTL_MS = 5 * 60 * 1000;

const generateOtp = (): string => String(Math.floor(100000 + Math.random() * 900000));

export const normalizeIndianPhone = (rawPhone?: string): string | null => {
  if (rawPhone === undefined || rawPhone === null) return null;

  const value = String(rawPhone).trim();
  if (!value) return null;

  const digitsOnly = value.replace(/\D/g, "");
  if (!digitsOnly) return null;

  const withoutCountryCode = digitsOnly.startsWith("91") ? digitsOnly.slice(2) : digitsOnly;
  const localNumber = withoutCountryCode.startsWith("0") ? withoutCountryCode.slice(1) : withoutCountryCode;

  if (!/^[6-9]\d{9}$/.test(localNumber)) {
    return null;
  }

  return `+91${localNumber}`;
};

export const isDevelopmentOtpEnabled = (): boolean => {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  return process.env.DEV_OTP_ENABLED !== "false";
};

export const sendOtp = async (phone: string) => {
  const normalizedPhone = normalizeIndianPhone(phone);

  if (!normalizedPhone) {
    return {
      success: false,
      message: "Enter a valid Indian mobile number.",
      phone: null,
      otp: undefined,
      devMode: false,
    };
  }

  if (!isDevelopmentOtpEnabled()) {
    return {
      success: true,
      message: "OTP sent successfully.",
      phone: normalizedPhone,
      otp: undefined,
      devMode: false,
    };
  }

  const otp = generateOtp();
  otpStore.set(normalizedPhone, {
    otp,
    expiresAt: Date.now() + OTP_TTL_MS,
  });

  return {
    success: true,
    message: "OTP sent successfully.",
    phone: normalizedPhone,
    otp,
    devMode: true,
  };
};

export const verifyOtp = async (phone: string, enteredOtp: string) => {
  const normalizedPhone = normalizeIndianPhone(phone);

  if (!normalizedPhone) {
    return {
      success: false,
      message: "Enter a valid Indian mobile number.",
    };
  }

  if (!isDevelopmentOtpEnabled()) {
    return {
      success: false,
      message: "Development OTP is disabled in production.",
    };
  }

  if (!/^\d{6}$/.test(enteredOtp)) {
    return {
      success: false,
      message: "Enter the 6-digit OTP sent to your phone number.",
    };
  }

  const storedOtp = otpStore.get(normalizedPhone);

  if (!storedOtp || storedOtp.expiresAt < Date.now()) {
    otpStore.delete(normalizedPhone);
    return {
      success: false,
      message: "OTP has expired. Please request a new OTP.",
    };
  }

  if (enteredOtp !== storedOtp.otp) {
    return {
      success: false,
      message: "Invalid OTP. Please try again.",
    };
  }

  otpStore.delete(normalizedPhone);

  return {
    success: true,
    message: "OTP verified successfully.",
    phone: normalizedPhone,
  };
};
