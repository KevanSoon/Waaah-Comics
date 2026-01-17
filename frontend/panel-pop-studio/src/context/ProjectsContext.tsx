'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { apiService, Project } from '@/services/apiService';

interface ProjectsContextType {
  projects: Project[];
  isLoading: boolean;
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  refreshProjects: () => Promise<void>;
  createProject: (name: string, description?: string) => Promise<Project>;
  deleteProject: (projectId: string) => Promise<void>;
}

const ProjectsContext = createContext<ProjectsContextType | undefined>(undefined);

export const ProjectsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userId, getToken, isSignedIn } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Initialize API service with auth token
  useEffect(() => {
    apiService.setAuthGetter(getToken);
  }, [getToken]);

  const refreshProjects = useCallback(async () => {
    if (!userId || !isSignedIn) {
      setProjects([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const data = await apiService.listProjects(userId);
      setProjects(data);
    } catch (err) {
      console.error('Failed to load projects:', err);
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId, isSignedIn]);

  const createProject = useCallback(async (name: string, description?: string): Promise<Project> => {
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const project = await apiService.createProject(userId, {
      name: name.trim(),
      description: description?.trim() || undefined,
    });

    // Optimistically update the UI
    setProjects(prev => [project, ...prev]);
    return project;
  }, [userId]);

  const deleteProject = useCallback(async (projectId: string): Promise<void> => {
    if (!userId) {
      throw new Error('User not authenticated');
    }

    await apiService.deleteProject(projectId, userId);
    
    // Remove from state
    setProjects(prev => prev.filter(p => p.id !== projectId));
    
    // Clear selection if the deleted project was selected
    if (selectedProjectId === projectId) {
      setSelectedProjectId(null);
    }
  }, [userId, selectedProjectId]);

  // Load projects on mount and when user changes
  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  const value: ProjectsContextType = {
    projects,
    isLoading,
    selectedProjectId,
    setSelectedProjectId,
    refreshProjects,
    createProject,
    deleteProject,
  };

  return (
    <ProjectsContext.Provider value={value}>
      {children}
    </ProjectsContext.Provider>
  );
};

export const useProjects = (): ProjectsContextType => {
  const context = useContext(ProjectsContext);
  if (context === undefined) {
    throw new Error('useProjects must be used within a ProjectsProvider');
  }
  return context;
};
