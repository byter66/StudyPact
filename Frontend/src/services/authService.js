import { apiRequest } from "./apiClient";

export const authService = {
  async requestOtp(phone, fullName, mode) {
    return apiRequest("/api/auth/send-otp", {
      method: "POST",
      body: JSON.stringify({ phone, fullName, mode }),
    });
  },

  async verifyOtp(phone, token, fullName) {
    const result = await apiRequest("/api/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ phone, token, fullName }),
    });

    if (result?.session) {
      localStorage.setItem("studypact-session", JSON.stringify(result.session));
      localStorage.setItem("studypact-user", JSON.stringify(result.user));
    }

    return result;
  },

  async getCurrentUser() {
    return apiRequest("/api/auth/me");
  },

  async signOut() {
    const result = await apiRequest("/api/auth/signout", { method: "POST" });
    localStorage.removeItem("studypact-session");
    localStorage.removeItem("studypact-user");
    return result;
  },
};
