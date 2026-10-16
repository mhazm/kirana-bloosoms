/**
 * Konfigurasi PM2 untuk Kirana.
 *
 *   pm2 start ecosystem.config.cjs
 *   pm2 save && pm2 startup
 *
 * Pakai .cjs karena package.json memakai "type": "module".
 */
module.exports = {
  apps: [
    {
      name: 'kirana',
      script: 'src/index.js',
      cwd: __dirname, // .env dan data/ dibaca relatif ke folder ini

      // WAJIB 1 instance: lebih dari satu akan mengirim embed & notifikasi ganda.
      exec_mode: 'fork',
      instances: 1,

      // Batasi heap V8 agar GC lebih agresif dan RAM tetap kecil.
      node_args: '--max-old-space-size=128',
      // Jaring pengaman: restart jika RSS melewati batas ini.
      max_memory_restart: '180M',

      // Restart otomatis dengan jeda bertahap (100ms -> maks 15s) saat crash,
      // misalnya ketika jaringan VPS atau Discord sedang gangguan.
      autorestart: true,
      exp_backoff_restart_delay: 100,

      // Bot menangani SIGINT untuk menutup koneksi Discord & database dengan rapi.
      kill_timeout: 10_000,

      watch: false,

      // Logger Kirana sudah mencetak timestamp sendiri.
      time: false,
      merge_logs: true,
      out_file: './logs/kirana.out.log',
      error_file: './logs/kirana.error.log',

      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
