'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Modal, ModalHeader, GlassButton, useToast } from '@/components/ui';
import { Header } from '@/components/admin/Header';
import { StatsCards } from '@/components/admin/StatsCards';
import { UsersTable } from '@/components/admin/UsersTable';
import { UserForm } from '@/components/forms/UserForm';
import { useAuth } from '@/hooks/useAuth';
import { fetchUsers, deleteUser } from '@/lib/api';
import type { User } from '@/lib/types';

export default function AdminDashboard() {
  const router = useRouter();
  const { showToast } = useToast();
  const { isAuthenticated, adminName, logout } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    const res = await fetchUsers();
    if (res.ok && res.data) {
      setUsers(res.data);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (isAuthenticated === false) {
      router.push('/admin/login');
    } else if (isAuthenticated === true) {
      loadUsers();
    }
  }, [isAuthenticated, router, loadUsers]);

  const handleLogout = () => {
    logout();
    router.push('/admin/login');
  };

  const handleAddUser = () => {
    setEditingUser(null);
    setUserModalOpen(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setUserModalOpen(true);
  };

  const handleDeleteClick = (user: User) => {
    setDeletingUser(user);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingUser) return;

    setIsDeleting(true);
    const res = await deleteUser(deletingUser.id);

    if (res.ok) {
      showToast('Usuario desactivado', 'success');
      setDeleteModalOpen(false);
      setDeletingUser(null);
      loadUsers();
    } else {
      showToast('Error al desactivar usuario');
    }

    setIsDeleting(false);
  };

  // Wait for auth check
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="inline-block w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen">
      <Header adminName={adminName} onLogout={handleLogout} />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <StatsCards users={users} />

        <UsersTable
          users={users}
          isLoading={isLoading}
          onEdit={handleEditUser}
          onDelete={handleDeleteClick}
          onAddUser={handleAddUser}
        />
      </main>

      {/* User Form Modal */}
      <UserForm
        isOpen={userModalOpen}
        onClose={() => setUserModalOpen(false)}
        user={editingUser}
        onSuccess={loadUsers}
      />

      {/* Delete Confirmation Modal */}
      <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} className="max-w-sm text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-red-400">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Desactivar Usuario</h2>
        <p className="text-white/60 mb-1">
          Estas seguro de desactivar a <strong className="text-white">{deletingUser?.username}</strong>?
        </p>
        <p className="text-white/40 text-sm mb-6">El usuario no podra iniciar sesion.</p>
        <div className="flex gap-3">
          <GlassButton
            variant="secondary"
            onClick={() => setDeleteModalOpen(false)}
            className="flex-1"
          >
            Cancelar
          </GlassButton>
          <GlassButton
            variant="danger"
            onClick={handleConfirmDelete}
            isLoading={isDeleting}
            className="flex-1"
          >
            Desactivar
          </GlassButton>
        </div>
      </Modal>
    </div>
  );
}
