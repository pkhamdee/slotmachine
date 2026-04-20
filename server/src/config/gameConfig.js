export default {
  sessionDuration: parseInt(process.env.SESSION_DURATION || '180', 10),
  lobbyDuration: parseInt(process.env.LOBBY_DURATION || '10', 10),
};
