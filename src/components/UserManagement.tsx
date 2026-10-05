"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";

interface User {
  id: string;
  username: string;
  role: string;
  displayName?: string;
  email?: string;
  authProvider: string;
  permissions?: {
    editSong: { songId: string; lang: string }[];
    editAlbum: { albumId: string; lang: string }[];
    editLanguage: string[];
  };
  created?: string;
}

interface PermissionItem {
  type: 'song' | 'album' | 'language';
  id: string;
  lang: string;
}

export function UserManagement() {
  const router = useRouter();
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<PermissionItem[]>([]);
  const [availableSongs, setAvailableSongs] = useState<{ id: string; title: string; translations: string[] }[]>([]);
  const [availableAlbums, setAvailableAlbums] = useState<{ id: string; title: string }[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [searchUser, setSearchUser] = useState("");

  useEffect(() => {
    fetchUsers();
    fetchOptions();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const fetchOptions = async () => {
    try {
      const [songsRes, albumsRes, langsRes] = await Promise.all([
        fetch("/api/songs?all=true"),
        fetch("/api/albums?all=true"),
        fetch("/api/languages"),
      ]);
      if (songsRes.ok) {
        const data = await songsRes.json();
        setAvailableSongs(data);
      }
      if (albumsRes.ok) {
        const data = await albumsRes.json();
        setAvailableAlbums(data);
      }
      if (langsRes.ok) {
        const data = await langsRes.json();
        setLanguages(data.languages || []);
      }
    } catch {}
  };

  const openEditPermissions = (user: User) => {
    setEditingUser(user);
    const perms: PermissionItem[] = [];
    if (user.permissions) {
      user.permissions.editSong.forEach(p => perms.push({ type: 'song', id: p.songId, lang: p.lang }));
      user.permissions.editAlbum.forEach(p => perms.push({ type: 'album', id: p.albumId, lang: p.lang }));
      user.permissions.editLanguage.forEach(l => perms.push({ type: 'language', id: '', lang: l }));
    }
    setSelectedPermissions(perms);
  };

  const closeEdit = () => {
    setEditingUser(null);
    setSelectedPermissions([]);
  };

  const addPermission = () => {
    setSelectedPermissions([...selectedPermissions, { type: 'song', id: '', lang: languages[0] || 'en' }]);
  };

  const removePermission = (index: number) => {
    setSelectedPermissions(selectedPermissions.filter((_, i) => i !== index));
  };

  const updatePermission = (index: number, field: keyof PermissionItem, value: string) => {
    setSelectedPermissions(selectedPermissions.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const savePermissions = async () => {
    if (!editingUser) return;
    
    const permissions = {
      editSong: selectedPermissions.filter(p => p.type === 'song').map(p => ({ songId: p.id, lang: p.lang })),
      editAlbum: selectedPermissions.filter(p => p.type === 'album').map(p => ({ albumId: p.id, lang: p.lang })),
      editLanguage: selectedPermissions.filter(p => p.type === 'language').map(p => p.lang),
    };

    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: editingUser.id, permissions }),
      });
      if (!res.ok) throw new Error("Failed to save permissions");
      await fetchUsers();
      closeEdit();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });
      if (!res.ok) throw new Error("Failed to update role");
      await fetchUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update role");
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm("Delete this user?")) return;
    try {
      const res = await fetch(`/api/admin/users?id=${userId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete user");
      await fetchUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const getSongTitle = (songId: string) => {
    const song = availableSongs.find(s => s.id === songId);
    return song ? song.title : songId;
  };

  const getAlbumTitle = (albumId: string) => {
    const album = availableAlbums.find(a => a.id === albumId);
    return album ? album.title : albumId;
  };

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchUser.toLowerCase()) ||
    u.displayName?.toLowerCase().includes(searchUser.toLowerCase())
  );

  if (loading) return <div className="text-center py-8">Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">{t('admin.userManagement')}</h1>

      {error && (
        <div className="mb-4 px-4 py-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          value={searchUser}
          onChange={(e) => setSearchUser(e.target.value)}
          placeholder={t('admin.searchUsers')}
          className="w-full max-w-md px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full">
          <thead className="bg-neutral-50 dark:bg-neutral-900">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">{t('admin.username')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">{t('admin.displayName')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">{t('admin.role')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">{t('admin.permissions')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">{t('admin.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {filteredUsers.map(user => (
              <tr key={user.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800">
                <td className="px-4 py-3 text-sm font-mono">{user.username}</td>
                <td className="px-4 py-3 text-sm">{user.displayName || '-'}</td>
                <td className="px-4 py-3 text-sm">
                  <select
                    value={user.role}
                    onChange={(e) => updateUserRole(user.id, e.target.value)}
                    className="px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-900 text-sm"
                  >
                    <option value="public">{t('auth.public')}</option>
                    <option value="setlist_creator">{t('auth.setlist_creator')}</option>
                    <option value="reviewer">{t('auth.reviewer')}</option>
                    <option value="admin">{t('auth.admin')}</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-sm">
                  {user.permissions && (
                    <div className="flex flex-wrap gap-1">
                      {user.permissions.editLanguage.map(lang => (
                        <span key={lang} className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-xs">
                          {t('admin.fullLanguage')}: {lang}
                        </span>
                      ))}
                      {user.permissions.editSong.map(p => (
                        <span key={`${p.songId}-${p.lang}`} className="px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded text-xs">
                          {t('admin.song')}: {getSongTitle(p.songId)} ({p.lang})
                        </span>
                      ))}
                      {user.permissions.editAlbum.map(p => (
                        <span key={`${p.albumId}-${p.lang}`} className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 rounded text-xs">
                          {t('admin.album')}: {getAlbumTitle(p.albumId)} ({p.lang})
                        </span>
                      ))}
                      {!user.permissions.editLanguage.length && !user.permissions.editSong.length && !user.permissions.editAlbum.length && (
                        <span className="text-neutral-400 text-xs">{t('admin.noPermissions')}</span>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditPermissions(user)}
                      className="text-blue-600 dark:text-blue-400 hover:underline text-xs"
                    >
                      {t('admin.editPermissions')}
                    </button>
                    {user.id !== users.find(u => u.role === 'admin')?.id && (
                      <button
                        onClick={() => deleteUser(user.id)}
                        className="text-red-600 dark:text-red-400 hover:underline text-xs"
                      >
                        {t('common.delete')}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Permissions Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('admin.editPermissionsFor')} {editingUser.displayName || editingUser.username}</h2>
              <button onClick={closeEdit} className="text-neutral-400 hover:text-neutral-600">×</button>
            </div>
            <div className="p-4 space-y-4">
              {selectedPermissions.map((perm, index) => (
                <div key={index} className="flex flex-wrap gap-2 items-center p-3 border border-neutral-200 dark:border-neutral-700 rounded">
                  <select
                    value={perm.type}
                    onChange={(e) => updatePermission(index, 'type', e.target.value)}
                    className="px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-900 text-sm w-32"
                  >
                    <option value="song">{t('admin.song')}</option>
                    <option value="album">{t('admin.album')}</option>
                    <option value="language">{t('admin.fullLanguage')}</option>
                  </select>
                  
                  {perm.type === 'song' && (
                    <select
                      value={perm.id}
                      onChange={(e) => updatePermission(index, 'id', e.target.value)}
                      className="px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-900 text-sm flex-1 min-w-[200px]"
                    >
                      <option value="">{t('admin.selectSong')}</option>
                      {availableSongs.map(s => (
                        <option key={s.id} value={s.id}>{s.title}</option>
                      ))}
                    </select>
                  )}
                  
                  {perm.type === 'album' && (
                    <select
                      value={perm.id}
                      onChange={(e) => updatePermission(index, 'id', e.target.value)}
                      className="px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-900 text-sm flex-1 min-w-[200px]"
                    >
                      <option value="">{t('admin.selectAlbum')}</option>
                      {availableAlbums.map(a => (
                        <option key={a.id} value={a.id}>{a.title}</option>
                      ))}
                    </select>
                  )}
                  
                  {perm.type === 'language' && (
                    <span className="text-sm text-neutral-500 w-32">{t('admin.allSongsInLanguage')}</span>
                  )}
                  
                  <select
                    value={perm.lang}
                    onChange={(e) => updatePermission(index, 'lang', e.target.value)}
                    className="px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-900 text-sm w-24"
                  >
                    {languages.map(l => (
                      <option key={l} value={l}>{l.toUpperCase()}</option>
                    ))}
                  </select>
                  
                  <button
                    onClick={() => removePermission(index)}
                    className="text-red-600 dark:text-red-400 hover:underline text-sm"
                  >
                    {t('common.delete')}
                  </button>
                </div>
              ))}
              <button
                onClick={addPermission}
                className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-sm"
              >
                + {t('admin.addPermission')}
              </button>
              <div className="flex gap-2 pt-4">
                <button
                  onClick={closeEdit}
                  className="flex-1 px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={savePermissions}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {t('common.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}