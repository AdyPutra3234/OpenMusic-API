const { nanoid } = require('nanoid');
const { Pool } = require('pg');
const InvariantError = require('../../exceptions/InVariantError');
const NotFoundError = require('../../exceptions/NotFoundError');
const AuthorizationError = require('../../exceptions/AuthorizationError');

class PlaylistsService {
  constructor(collaborationsService, cacheService) {
    this._pool = new Pool();
    this._collaborationsService = collaborationsService;
    this._cacheService = cacheService;
  }

  async addPlaylist(playlistName, owner) {
    const id = `playlist-${nanoid(16)}`;

    const query = {
      text: 'INSERT INTO playlists VALUES ($1, $2, $3) RETURNING id',
      values: [id, playlistName, owner],
    };

    const { rows } = await this._pool.query(query);

    if (!rows[0].id) throw new InvariantError('Playlist gagal ditambahkan');

    await this._cacheService.delete(`playlists:${owner}`);

    return rows[0].id;
  }

  async getPlaylists(userId) {
    try {
      const result = await this._cacheService.get(`playlists:${userId}`);
      return JSON.parse(result);
    } catch (error) {
      const query = {
        text: 'SELECT playlists.id, playlists.name, users.username FROM playlists LEFT JOIN users ON users.id = playlists.owner LEFT JOIN collaborations ON collaborations.playlist_id = playlists.id WHERE playlists.owner = $1 OR collaborations.user_id = $1',
        values: [userId],
      };

      const { rows } = await this._pool.query(query);

      await this._cacheService.set(`playlists:${userId}`, JSON.stringify(rows));

      return rows;
    }
  }

  async deletePlaylistById(id) {
    const query = {
      text: 'DELETE FROM playlists WHERE id = $1 RETURNING id, owner',
      values: [id],
    };

    const result = await this._pool.query(query);

    if (!result.rowCount) throw new NotFoundError('Playlist gagal dihapus, id tidak ditemukan');

    const { owner } = result.rows[0];

    await this._cacheService.delete(`playlists:${owner}`);
  }

  async verifyPlaylistOwner(playlistId, owner) {
    const query = {
      text: 'SELECT owner FROM playlists WHERE id = $1',
      values: [playlistId],
    };

    const result = await this._pool.query(query);

    if (!result.rowCount) throw new NotFoundError('Playlist tidak ditemukan');

    const { owner: playlistOwner } = result.rows[0];

    if (owner !== playlistOwner) throw new AuthorizationError('Anda tidak berhak mengakses resource ini');
  }

  async verifyPlaylistAccess(playlistId, userId) {
    try {
      await this.verifyPlaylistOwner(playlistId, userId);
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      try {
        await this._collaborationsService.verifyCollaborator(playlistId, userId);
      } catch {
        throw error;
      }
    }
  }
}

module.exports = PlaylistsService;
