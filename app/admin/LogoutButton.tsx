"use client";

import styles from "./admin.module.css";

export function LogoutButton() {
  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin";
  }

  return (
    <button className={styles.ghostButton} onClick={logout} type="button">
      ログアウト
    </button>
  );
}
