import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import styles from '../styles/Login.module.css';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login gagal');
      }

      // ✅ Simpan token, user object, dan user_id secara terpisah
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('user_id', data.user.id); // <== Tambahan penting

      // Redirect ke halaman utama
      router.push('/');

    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Login | Your App Name</title>
        <meta name="description" content="Login to access your account" />
      </Head>

      <div className={styles.container}>
        <div className={styles.formWrapper}>
          <div className={styles.logoContainer}>
            <Image 
              src="/bot-image.jpg" 
              alt="Logo" 
              width={50} 
              height={50} 
              className={styles.logo}
            />
            <h1 className={styles.title}>CyberRubi, YOUR SAFETY</h1>
            <p className={styles.subtitle}>Masuk untuk melanjutkan ke akun Anda</p>
          </div>

          {error && <div className={styles.errorMessage}>{error}</div>}

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.inputGroup}>
              <label htmlFor="email" className={styles.label}>Alamat Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.input}
                placeholder="your.email@example.com"
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <div className={styles.labelRow}>
                <label htmlFor="password" className={styles.label}>Kata Sandi</label>
                <Link href="/forgot-password" className={styles.forgotPassword}>
                  Lupa Kata Sandi?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.input}
                placeholder="••••••••"
                required    
              />
            </div>

            <button 
              type="submit" 
              className={styles.button}
              disabled={isLoading}
            >
              {isLoading ? 'Sedang Masuk...' : 'Masuk'}
            </button>
          </form>

          <div className={styles.footer}>
            <p>
              Belum memiliki akun?{' '}
              <Link href="/register" className={styles.link}>
                Buat Akun
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
