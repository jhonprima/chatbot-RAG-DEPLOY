import { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/utils/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 1. Hanya izinkan metode GET
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      error: 'Method Not Allowed',
      message: `Hanya metode GET yang diizinkan`,
    });
  }

  // 2. Ambil dan validasi user_id dari query
  const { user_id } = req.query;

  if (!user_id || typeof user_id !== 'string') {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Parameter user_id diperlukan dan harus berupa string',
    });
  }

  // 3. Validasi format UUID (opsional)
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user_id);
  if (!isUUID) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Format user_id tidak valid',
    });
  }

  try {
    // 4. Query database
    const result = await pool.query(
      `SELECT 
         id, 
         title, 
         TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at
       FROM chats 
       WHERE user_id = $1 
       ORDER BY created_at DESC
       LIMIT 100`,
      [user_id]
    );

    // 5. Format response
    return res.status(200).json({
      success: true,
      data: result.rows,
      count: result.rowCount,
    });
  } catch (error: any) {
    console.error('Error fetching chats:', error);

    // 6. Handle error khusus database
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Database tidak dapat diakses',
      });
    }

    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Terjadi kesalahan saat mengambil data chat',
    });
  }
}
