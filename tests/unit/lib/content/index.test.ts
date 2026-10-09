import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTempContentDir } from '../../../utils/temp-content';

describe('content/index.ts', () => {
  let tempDir: Awaited<ReturnType<typeof createTempContentDir>>;
  let contentModule: typeof import('@/lib/content');
  
  beforeEach(async () => {
    vi.resetModules();
    tempDir = await createTempContentDir();
    contentModule = await import('@/lib/content');
  });
  
  afterEach(async () => {
    if (tempDir) {
      await tempDir.cleanup();
    }
  });

  const listSongs = () => contentModule.listSongs;
  const createSong = () => contentModule.createSong;
  const saveSongTranslation = () => contentModule.saveSongTranslation;
  const getSong = () => contentModule.getSong;
  const getSongTranslation = () => contentModule.getSongTranslation;
  const deleteSong = () => contentModule.deleteSong;
  const NO_ALBUM_ID = () => contentModule.NO_ALBUM_ID;
  const createAlbum = () => contentModule.createAlbum;
  const getAlbum = () => contentModule.getAlbum;
  const saveAlbum = () => contentModule.saveAlbum;
  const listAlbums = () => contentModule.listAlbums;
  const listArtists = () => contentModule.listArtists;
  const getArtist = () => contentModule.getArtist;
  const saveArtist = () => contentModule.saveArtist;
  const getSongTranslations = () => contentModule.getSongTranslations;
  const addSongTranslation = () => contentModule.addSongTranslation;
  const deleteSongTranslation = () => contentModule.deleteSongTranslation;
  const saveSongMeta = () => contentModule.saveSongMeta;
  const renameSong = () => contentModule.renameSong;
  const changeSongAlbum = () => contentModule.changeSongAlbum;
  const getLanguagesConfig = () => contentModule.getLanguagesConfig;
  const getSiteConfig = () => contentModule.getSiteConfig;

  describe('createSong', () => {
    it('creates song in no-album by default', async () => {
      await createSong()('amazing-grace', 'Amazing Grace', 'en');
      
      const song = await getSong()('amazing-grace');
      expect(song.id).toBe('amazing-grace');
      expect(song.title).toBe('Amazing Grace');
      
      expect(await tempDir.exists('library/no-album/amazing-grace/meta.yaml')).toBe(true);
      expect(await tempDir.exists('library/no-album/amazing-grace/en.cho')).toBe(true);
    });

    it('creates song in specified album', async () => {
      await createAlbum()('hymns-2024', 'Hymns 2024', 'various-artists');
      
      await createSong()('amazing-grace', 'Amazing Grace', 'en', 'hymns-2024');
      
      const song = await getSong()('amazing-grace');
      expect(song.id).toBe('amazing-grace');
      expect(await tempDir.exists('library/hymns-2024/amazing-grace/meta.yaml')).toBe(true);
    });

    it('overwrites existing song on duplicate ID', async () => {
      await createSong()('test-song', 'Test Song', 'en');
      // createSong doesn't throw on duplicate, it overwrites
      await createSong()('test-song', 'Another Song', 'en');
      
      const song = await getSong()('test-song');
      expect(song.title).toBe('Another Song');
    });

    it('accepts custom body content', async () => {
      await createSong()('custom-song', 'Custom Song', 'en', 'no-album', '{title: Custom}\n\nMy custom content');
      
      const { body } = await getSongTranslation()('custom-song', 'en');
      expect(body).toContain('My custom content');
    });
  });

  describe('saveSongTranslation', () => {
    beforeEach(async () => {
      await createSong()('test-song', 'Test Song', 'en');
    });

    it('saves translation with frontmatter', async () => {
      await saveSongTranslation()('test-song', 'es', {
        language: 'es',
        translator: 'Juan',
        status: 'final',
        published: true,
      }, '{title: Cántico Nuevo}\n\n{verse: 1}\nNuevo cántico cantaré');
      
      const { meta, body } = await getSongTranslation()('test-song', 'es');
      expect(meta.translator).toBe('Juan');
      expect(meta.status).toBe('final');
      expect(meta.published).toBe(true);
      expect(body).toContain('Cántico Nuevo');
    });

    it('creates revision snapshot before overwrite', async () => {
      await saveSongTranslation()('test-song', 'en', {
        language: 'en', status: 'draft', published: false
      }, '{title: Original}\nVerse 1');
      
      await saveSongTranslation()('test-song', 'en', {
        language: 'en', status: 'final', published: true
      }, '{title: Updated}\nVerse 1\nVerse 2');
      
      const { listRevisions } = await import('@/lib/content/revisions');
      const songPath = await (await import('@/lib/content')).findSongPath('test-song');
      const revisions = await listRevisions(songPath!, 'en');
      // First save in beforeEach creates the file, then two saves in test create 2 revisions
      expect(revisions.length).toBe(2);
    });
  });

  describe('listSongs', () => {
    beforeEach(async () => {
      await createSong()('published-song', 'Published Song', 'en');
      await createSong()('draft-song', 'Draft Song', 'en');
      
      await saveSongTranslation()('published-song', 'en', {
        language: 'en', status: 'final', published: true
      }, '{title: Published}\nContent');
      
      await saveSongTranslation()('draft-song', 'en', {
        language: 'en', status: 'draft', published: false
      }, '{title: Draft}\nContent');
    });

    it('filters by published status for non-admin', async () => {
      const publicSongs = await listSongs()({ onlyPublished: true, role: 'public' });
      const adminSongs = await listSongs()({ onlyPublished: true, role: 'admin' });
      
      expect(publicSongs.map(s => s.id)).toEqual(['published-song']);
      expect(adminSongs.map(s => s.id)).toContain('published-song');
      expect(adminSongs.map(s => s.id)).toContain('draft-song');
    });

    it('returns all songs when onlyPublished is false', async () => {
      const songs = await listSongs()({ onlyPublished: false });
      expect(songs.map(s => s.id)).toContain('published-song');
      expect(songs.map(s => s.id)).toContain('draft-song');
    });

    it('includes translation info', async () => {
      await saveSongTranslation()('published-song', 'es', {
        language: 'es', status: 'final', published: true
      }, '{title: Publicado}\nContenido');
      
      const songs = await listSongs()({ role: 'admin' });
      const song = songs.find(s => s.id === 'published-song');
      expect(song?.translations).toContain('en');
      expect(song?.translations).toContain('es');
    });
  });

  describe('deleteSong', () => {
    it('removes song and updates album', async () => {
      await createAlbum()('test-album', 'Test Album', 'various-artists');
      await createSong()('song-to-delete', 'Song to Delete', 'en', 'test-album');
      
      await deleteSong()('song-to-delete');
      
      await expect(getSong()('song-to-delete')).rejects.toThrow('Song not found');
      expect(await tempDir.exists('library/test-album/song-to-delete')).toBe(false);
    });

    it('removes song from no-album', async () => {
      await createSong()('no-album-song', 'No Album Song', 'en');
      await deleteSong()('no-album-song');
      
      await expect(getSong()('no-album-song')).rejects.toThrow('Song not found');
      expect(await tempDir.exists('library/no-album/no-album-song')).toBe(false);
    });
  });

  describe('Album operations', () => {
    it('creates album with required fields', async () => {
      await createAlbum()('album-1', 'Album One', 'various-artists', 2024, 1);
      
      const album = await getAlbum()('album-1');
      expect(album.id).toBe('album-1');
      expect(album.title).toBe('Album One');
      expect(album.artist).toBe('various-artists');
      expect(album.year).toBe(2024);
      expect(album.number).toBe(1);
    });

    it('lists albums', async () => {
      await createAlbum()('album-a', 'Album A', 'various-artists');
      await createAlbum()('album-b', 'Album B', 'various-artists');
      
      const albums = await listAlbums()();
      expect(albums.map(a => a.id)).toContain('album-a');
      expect(albums.map(a => a.id)).toContain('album-b');
    });

    it('saves album updates', async () => {
      await createAlbum()('album-update', 'Original Title', 'various-artists');
      
      const album = await getAlbum()('album-update');
      album.title = 'Updated Title';
      await saveAlbum()(album);
      
      const updated = await getAlbum()('album-update');
      expect(updated.title).toBe('Updated Title');
    });
  });

  describe('Artist operations', () => {
    it('lists artists', async () => {
      await saveArtist()({
        id: 'artist-1',
        name: 'Artist One',
        bio: 'Bio',
        tags: ['tag1'],
      });
      
      const artists = await listArtists()();
      expect(artists.map(a => a.id)).toContain('artist-1');
    });

    it('gets artist by id', async () => {
      await saveArtist()({
        id: 'artist-get',
        name: 'Get Artist',
        bio: 'Test bio',
        tags: [],
      });
      
      const artist = await getArtist()('artist-get');
      expect(artist.name).toBe('Get Artist');
    });
  });

  describe('Translation operations', () => {
    beforeEach(async () => {
      await createSong()('trans-song', 'Translation Song', 'en');
    });

    it('gets song translations', async () => {
      await saveSongTranslation()('trans-song', 'es', {
        language: 'es', status: 'draft', published: false
      }, '{title: Español}\nContenido');
      
      await saveSongTranslation()('trans-song', 'fr', {
        language: 'fr', status: 'draft', published: false
      }, '{title: Français}\nContenu');
      
      const translations = await getSongTranslations()('trans-song');
      expect(translations).toContain('en');
      expect(translations).toContain('es');
      expect(translations).toContain('fr');
    });

    it('adds new translation', async () => {
      await addSongTranslation()('trans-song', 'de');
      
      const translations = await getSongTranslations()('trans-song');
      expect(translations).toContain('de');
      
      const { meta } = await getSongTranslation()('trans-song', 'de');
      expect(meta.language).toBe('de');
      expect(meta.status).toBe('draft');
    });

    it('throws when adding existing translation', async () => {
      await expect(addSongTranslation()('trans-song', 'en')).rejects.toThrow('TRANSLATION_EXISTS');
    });

    it('deletes translation but keeps at least one', async () => {
      await saveSongTranslation()('trans-song', 'es', {
        language: 'es', status: 'draft', published: false
      }, '{title: Español}\nContenido');
      
      const remaining = await deleteSongTranslation()('trans-song', 'es');
      expect(remaining).toEqual(['en']);
    });

    it('throws when deleting last translation', async () => {
      await expect(deleteSongTranslation()('trans-song', 'en')).rejects.toThrow('LAST_TRANSLATION');
    });
  });

  describe('Song metadata', () => {
    it('saves song meta', async () => {
      await createSong()('meta-song', 'Meta Song', 'en');
      
      await saveSongMeta()('meta-song', {
        id: 'meta-song',
        title: 'Updated Title',
        titles: { es: 'Título en español' },
        tags: ['worship', 'hymn'],
        key: 'G',
        capo: 2,
        tempo: 120,
        ccli: '1234567',
        references: [],
        audioFiles: [],
        partitions: [],
      });
      
      const song = await getSong()('meta-song');
      expect(song.title).toBe('Updated Title');
      expect(song.titles?.es).toBe('Título en español');
      expect(song.tags).toEqual(['worship', 'hymn']);
      expect(song.key).toBe('G');
      expect(song.capo).toBe(2);
    });
  });

  describe('Rename operations', () => {
    it('renames song and updates references', async () => {
      await createAlbum()('rename-album', 'Rename Album', 'various-artists');
      await createSong()('old-id', 'Old Title', 'en', 'rename-album');
      
      // Create a setlist referencing the song
      const { saveSetlist } = await import('@/lib/content');
      await saveSetlist({
        id: 'setlist-1',
        title: 'Test Setlist',
        songs: [{ songId: 'old-id', lang: 'en' }],
      });
      
      await renameSong()('old-id', 'new-id');
      
      const song = await getSong()('new-id');
      expect(song.id).toBe('new-id');
      expect(await tempDir.exists('library/rename-album/new-id')).toBe(true);
      expect(await tempDir.exists('library/rename-album/old-id')).toBe(false);
      
      // Check setlist was updated
      const { getSetlist } = await import('@/lib/content');
      const setlist = await getSetlist('setlist-1');
      expect(setlist.songs[0].songId).toBe('new-id');
    });
  });

  describe('Change song album', () => {
    it('moves song between albums', async () => {
      await createAlbum()('album-a', 'Album A', 'various-artists');
      await createAlbum()('album-b', 'Album B', 'various-artists');
      await createSong()('move-song', 'Move Song', 'en', 'album-a');
      
      await changeSongAlbum()('move-song', 'album-b');
      
      expect(await tempDir.exists('library/album-a/move-song')).toBe(false);
      expect(await tempDir.exists('library/album-b/move-song')).toBe(true);
      
      const albumA = await getAlbum()('album-a');
      const albumB = await getAlbum()('album-b');
      expect(albumA.songs).not.toContain('move-song');
      expect(albumB.songs).toContain('move-song');
    });

    it('moves song to no-album', async () => {
      await createAlbum()('album-c', 'Album C', 'various-artists');
      await createSong()('to-no-album', 'To No Album', 'en', 'album-c');
      
      await changeSongAlbum()('to-no-album', NO_ALBUM_ID());
      
      expect(await tempDir.exists('library/album-c/to-no-album')).toBe(false);
      expect(await tempDir.exists('library/no-album/to-no-album')).toBe(true);
    });
  });

  describe('Config operations', () => {
    it('gets languages config', async () => {
      const config = await getLanguagesConfig()();
      expect(config.languages).toContain('en');
      expect(config.default).toBe('en');
    });

    it('gets site config', async () => {
      const config = await getSiteConfig()();
      expect(config.title).toBe('Test Songbook');
      expect(config.defaultLanguage).toBe('en');
    });
  });
});