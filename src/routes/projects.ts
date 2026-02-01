import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import jwt from 'jsonwebtoken';

const router = Router();

const MAX_PROJECTS_PER_USER = 15;

// Helper function to get userId from token
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

// Get all projects for user
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const projects = await prisma.project.findMany({
      where: { userId },
      include: { folder: true },
      orderBy: { updatedAt: 'desc' }
    });

    return res.status(200).json({
      success: true,
      count: projects.length,
      maxProjects: MAX_PROJECTS_PER_USER,
      canCreateMore: projects.length < MAX_PROJECTS_PER_USER,
      projects
    });

  } catch (error) {
    console.error("Get Projects Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch projects" });
  }
});

// Create a new project
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const { name, folderId, description, metadata } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: "Project name is required" });
    }

    // Check project limit
    const projectCount = await prisma.project.count({ where: { userId } });
    if (projectCount >= MAX_PROJECTS_PER_USER) {
      return res.status(403).json({ 
        success: false, 
        message: `Has alcanzado el límite de ${MAX_PROJECTS_PER_USER} proyectos. Elimina un proyecto existente para crear uno nuevo.`,
        maxProjects: MAX_PROJECTS_PER_USER,
        currentCount: projectCount
      });
    }

    // If folderId is provided, verify it belongs to user
    if (folderId) {
      const folder = await prisma.folder.findUnique({ where: { id: folderId } });
      if (!folder || folder.userId !== userId) {
        return res.status(403).json({ success: false, message: "Folder not found or unauthorized" });
      }
    }

    const project = await prisma.project.create({
      data: {
        userId,
        folderId: folderId || null,
        name,
        description: description || null,
        metadata: metadata || null
      },
      include: { folder: true }
    });

    return res.status(201).json({
      success: true,
      project,
      remainingProjects: MAX_PROJECTS_PER_USER - (projectCount + 1)
    });

  } catch (error) {
    console.error("Create Project Error:", error);
    return res.status(500).json({ success: false, message: "Failed to create project" });
  }
});

// Update a project
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const { id } = req.params;
    const { name, folderId, description, metadata } = req.body;

    // Verify project belongs to user
    const existingProject = await prisma.project.findUnique({ where: { id } });
    if (!existingProject || existingProject.userId !== userId) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    // If folderId is provided, verify it belongs to user
    if (folderId) {
      const folder = await prisma.folder.findUnique({ where: { id: folderId } });
      if (!folder || folder.userId !== userId) {
        return res.status(403).json({ success: false, message: "Folder not found or unauthorized" });
      }
    }

    const project = await prisma.project.update({
      where: { id },
      data: {
        name: name || existingProject.name,
        folderId: folderId !== undefined ? folderId : existingProject.folderId,
        description: description !== undefined ? description : existingProject.description,
        metadata: metadata !== undefined ? metadata : existingProject.metadata,
        updatedAt: new Date()
      },
      include: { folder: true }
    });

    return res.status(200).json({
      success: true,
      project
    });

  } catch (error) {
    console.error("Update Project Error:", error);
    return res.status(500).json({ success: false, message: "Failed to update project" });
  }
});

// Delete a project
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const { id } = req.params;

    // Verify project belongs to user
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project || project.userId !== userId) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    await prisma.project.delete({ where: { id } });

    const remainingCount = await prisma.project.count({ where: { userId } });

    return res.status(200).json({
      success: true,
      message: "Project deleted successfully",
      remainingProjects: MAX_PROJECTS_PER_USER - remainingCount,
      canCreateMore: true
    });

  } catch (error) {
    console.error("Delete Project Error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete project" });
  }
});

// Get folders for user
router.get('/folders', async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const folders = await prisma.folder.findMany({
      where: { userId },
      include: { projects: true },
      orderBy: { updatedAt: 'desc' }
    });

    return res.status(200).json({
      success: true,
      folders
    });

  } catch (error) {
    console.error("Get Folders Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch folders" });
  }
});

// Create a folder
router.post('/folders', async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: "Folder name is required" });
    }

    const folder = await prisma.folder.create({
      data: { userId, name }
    });

    return res.status(201).json({
      success: true,
      folder
    });

  } catch (error) {
    console.error("Create Folder Error:", error);
    return res.status(500).json({ success: false, message: "Failed to create folder" });
  }
});

// Delete a folder
router.delete('/folders/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const { id } = req.params;

    const folder = await prisma.folder.findUnique({ where: { id } });
    if (!folder || folder.userId !== userId) {
      return res.status(404).json({ success: false, message: "Folder not found" });
    }

    // Delete folder (projects will have folderId set to null due to SetNull)
    await prisma.folder.delete({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Folder deleted successfully"
    });

  } catch (error) {
    console.error("Delete Folder Error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete folder" });
  }
});

export default router;
