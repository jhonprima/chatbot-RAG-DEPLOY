import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import styles from '../styles/Login.module.css'; // Menggunakan style yang sama dengan Login

export default function Register() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Validasi password
      if (
        password.length < 6 ||
        !/[A-Z]/.test(password) ||
        !/[0-9]/.test(password)
      ) {
        throw new Error('Password harus 6+ karakter, mengandung huruf besar & angka');
      }

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle error messages dari backend
        throw new Error(data.message || 'Registrasi gagal');
      }

      // Simpan token dan redirect
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      router.push('/'); 
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat registrasi');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Registrasi | CyberFox User</title>
        <meta name="description" content="Buat akun baru untuk aplikasi kami" />
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
            <h1 className={styles.title}>Buat Akun Baru</h1>
            <p className={styles.subtitle}>Daftar untuk mulai menggunakan layanan kami</p>
          </div>

          {error && <div className={styles.errorMessage}>{error}</div>}

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.inputGroup}>
              <label htmlFor="name" className={styles.label}>Nama Lengkap</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={styles.input}
                placeholder="Nama Lengkap Anda"
                required
              />
            </div>

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
              <label htmlFor="password" className={styles.label}>Kata Sandi</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.input}
                placeholder="••••••••"
                required
              />
              <p className={styles.passwordHelper}>
                Minimal 6 karakter, mengandung huruf besar dan angka
              </p>
            </div>

            <button
              type="submit"
              className={styles.button}
              disabled={isLoading}
            >
              {isLoading ? 'Sedang Mendaftar...' : 'Daftar'}
            </button>
          </form>

          <div className={styles.footer}>
            <p>
              Sudah memiliki akun?{' '}
              <Link href="/login" className={styles.link}>
                Masuk
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}