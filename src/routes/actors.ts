import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const router = express.Router();
const prisma = new PrismaClient();

const getUserIdFromToken = (req: Request): string | null => {
  let token = req.cookies.auth_token;
  
  if (!token && req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) return null;

  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key-change-me');
    return decoded.userId;
  } catch (e) {
    return null;
  }
};

// GET /api/actors - Obtener todos los actores del usuario
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'No autorizado' });
    }

    const actors = await prisma.actor.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json({ 
      success: true, 
      actors 
    });
  } catch (error) {
    console.error('Error fetching actors:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al obtener actores' 
    });
  }
});

// POST /api/actors - Crear un nuevo actor
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'No autorizado' });
    }

    const { name, instruction, imageUrl, videoUrl, voiceId, gender, age, metadata } = req.body;

    if (!videoUrl) {
      return res.status(400).json({ 
        success: false, 
        message: 'El videoUrl es requerido' 
      });
    }

    const actor = await prisma.actor.create({
      data: {
        userId,
        name: name || 'Custom Actor',
        instruction,
        imageUrl,
        videoUrl,
        voiceId,
        gender: gender || 'F',
        age: age || 'Adult',
        status: 'completed',
        metadata: metadata || {}
      }
    });

    return res.status(201).json({ 
      success: true, 
      message: 'Actor creado exitosamente',
      actor 
    });
  } catch (error) {
    console.error('Error creating actor:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al crear actor' 
    });
  }
});

// GET /api/actors/:id - Obtener un actor específico
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'No autorizado' });
    }

    const { id } = req.params;

    const actor = await prisma.actor.findFirst({
      where: { 
        id,
        userId 
      }
    });

    if (!actor) {
      return res.status(404).json({ 
        success: false, 
        message: 'Actor no encontrado' 
      });
    }

    return res.status(200).json({ 
      success: true, 
      actor 
    });
  } catch (error) {
    console.error('Error fetching actor:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al obtener actor' 
    });
  }
});

// DELETE /api/actors/:id - Eliminar un actor
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'No autorizado' });
    }

    const { id } = req.params;

    const actor = await prisma.actor.findFirst({
      where: { 
        id,
        userId 
      }
    });

    if (!actor) {
      return res.status(404).json({ 
        success: false, 
        message: 'Actor no encontrado' 
      });
    }

    await prisma.actor.delete({
      where: { id }
    });

    return res.status(200).json({ 
      success: true, 
      message: 'Actor eliminado exitosamente' 
    });
  } catch (error) {
    console.error('Error deleting actor:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al eliminar actor' 
    });
  }
});

export default router;
