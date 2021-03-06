class AuthenticationsHandler {
  constructor(usersService, authenticationsService, tokenManager, validators) {
    this._usersService = usersService;
    this._authenticationsService = authenticationsService;
    this._tokenManager = tokenManager;
    this._validators = validators;

    this.postAuthenticationHandler = this.postAuthenticationHandler.bind(this);
    this.putAuthenticationHandler = this.putAuthenticationHandler.bind(this);
    this.deleteAuthenticationHandler = this.deleteAuthenticationHandler.bind(this);
  }

  async postAuthenticationHandler({ payload }, h) {
    this._validators.post.validate(payload);

    const { username, password } = payload;
    const id = await this._usersService.verifyUserCredential(username, password);

    const accessToken = this._tokenManager.generateAccessToken({ id });
    const refreshToken = this._tokenManager.generateRefreshToken({ id });

    await this._authenticationsService.addRefreshToken(refreshToken);

    const response = h.response({
      status: 'success',
      message: 'Authentication berhasil ditambahkan',
      data: {
        accessToken,
        refreshToken,
      },
    });
    response.code(201);
    return response;
  }

  async putAuthenticationHandler({ payload }, h) {
    this._validators.put.validate(payload);

    const { refreshToken } = payload;
    await this._authenticationsService.verifyRefreshToken(refreshToken);
    const { id } = await this._tokenManager.verifyRefreshToken(refreshToken);
    const accessToken = await this._tokenManager.generateAccessToken({ id });

    const response = h.response({
      status: 'success',
      message: 'Access token berhasil diperbarui',
      data: {
        accessToken,
      },
    });
    response.code(200);
    return response;
  }

  async deleteAuthenticationHandler({ payload }, h) {
    this._validators.delete.validate(payload);

    const { refreshToken } = payload;
    await this._authenticationsService.verifyRefreshToken(refreshToken);
    await this._authenticationsService.deleteRefreshToken(refreshToken);

    const response = h.response({
      status: 'success',
      message: 'Refresh token berhasil dihapus',
    });
    response.code(200);
    return response;
  }
}

module.exports = AuthenticationsHandler;
