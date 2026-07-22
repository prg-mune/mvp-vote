"use client";

import { useState } from "react";
import styles from "./admin.module.css";

export function AdminLoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    setIsLoading(false);

    if (!response.ok) {
      setError("パスワードが違います。");
      return;
    }

    window.location.reload();
  }

  return (
    <form className={styles.loginPanel} onSubmit={handleSubmit}>
      <p className={styles.eyebrow}>Admin Login</p>
      <h2>管理者ログイン</h2>
      <p>管理機能を利用するにはパスワードを入力してください。</p>
      <div className={styles.field}>
        <label htmlFor="admin-password">管理者パスワード</label>
        <input
          id="admin-password"
          autoComplete="current-password"
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          value={password}
        />
      </div>
      {error && <span className={styles.errorText}>{error}</span>}
      <button
        className={styles.primaryButton}
        disabled={!password.trim() || isLoading}
        type="submit"
      >
        {isLoading ? "確認中..." : "ログイン"}
      </button>
    </form>
  );
}
