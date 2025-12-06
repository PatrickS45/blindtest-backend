// src/services/gameEngine.js
// Moteur de jeu - Logique pour les 6 modes de jeu

const Round = require('../models/Round');
const qcmGenerator = require('./qcmGenerator');
const scoringEngine = require('../utils/scoring');
const { GAME_MODES, GAME_STATUS, SCORING_CONFIGS } = require('../config/constants');
const logger = require('../utils/logger');

class GameEngine {
  /**
   * Démarre un nouveau round
   * @param {Game} game
   * @returns {Promise<Round>}
   */
  async startRound(game) {
    // Sélectionner un track aléatoire
    const track = game.selectRandomTrack();
    if (!track) {
      throw new Error('Aucun track disponible');
    }

    // Créer le round
    const round = new Round(game.mode, track, game.config);

    // Réinitialiser les données des joueurs
    game.resetRoundData();

    // Configurer le round selon le mode
    await this.configureRoundByMode(game, round);

    // Démarrer le round
    round.start();
    game.currentRound = round;
    game.roundNumber++;
    game.status = GAME_STATUS.PLAYING;

    logger.info('Round started', {
      roomCode: game.roomCode,
      roundNumber: game.roundNumber,
      mode: game.mode,
      trackId: track.id
    });

    return round;
  }

  /**
   * Configure le round selon le mode de jeu
   * @param {Game} game
   * @param {Round} round
   */
  async configureRoundByMode(game, round) {
    switch (game.mode) {
      case GAME_MODES.QCM:
        // Générer le QCM automatiquement
        const qcm = await qcmGenerator.generateQCM(
          round.track,
          game.playlist.tracks,
          game.config.qcmType
        );
        round.setQCM(qcm);
        break;

      case GAME_MODES.QUESTIONS_RAFALE:
        // Générer les indices
        const hints = qcmGenerator.generateHints(round.track);
        round.setHints(hints);
        break;

      case GAME_MODES.CHAUD_DEVANT:
        // Sélectionner un joueur aléatoire pour la bombe
        const players = game.getPlayersArray();
        const randomPlayer = players[Math.floor(Math.random() * players.length)];
        round.setBombHolder(randomPlayer.id);
        round.bombTimer = 30; // 30 secondes
        break;

      // Les autres modes n'ont pas de configuration spéciale
      default:
        break;
    }
  }

  /**
   * Traite un buzz
   * @param {Game} game
   * @param {string} playerId
   * @param {string} playerName
   * @returns {Object}
   */
  handleBuzz(game, playerId, playerName) {
    const round = game.currentRound;

    if (!round) {
      throw new Error('Aucun round actif');
    }

    // Vérifier si le joueur a déjà buzzé
    if (round.hasBuzzed(playerId)) {
      throw new Error('Déjà buzzé');
    }

    // Pour certains modes, seul le PREMIER joueur peut buzzer
    const SINGLE_BUZZ_MODES = ['accumul_points', 'tueurs_gages'];
    if (SINGLE_BUZZ_MODES.includes(game.mode) && round.buzzOrder.length > 0) {
      console.log('⚠️ Buzz rejeté - quelqu\'un a déjà buzzé en mode', game.mode);
      throw new Error('Quelqu\'un a déjà buzzé');
    }

    // Enregistrer le buzz
    const position = round.recordBuzz(playerId, playerName);

    logger.info('Player buzzed', {
      roomCode: game.roomCode,
      playerId,
      playerName,
      position
    });

    return {
      playerId,
      playerName,
      position,
      timestamp: Date.now()
    };
  }

  /**
   * Traite une réponse QCM
   * @param {Game} game
   * @param {string} playerId
   * @param {number} optionIndex
   */
  handleQCMAnswer(game, playerId, optionIndex) {
    const round = game.currentRound;

    if (!round || !round.qcm) {
      throw new Error('Pas de QCM actif');
    }

    if (round.hasAnswered(playerId)) {
      throw new Error('Déjà répondu');
    }

    round.recordAnswer(playerId, optionIndex);

    logger.info('QCM answer recorded', {
      roomCode: game.roomCode,
      playerId,
      optionIndex
    });
  }

  /**
   * Valide une réponse (mode manuel)
   * @param {Game} game
   * @param {string} playerId
   * @param {boolean} isCorrect
   * @returns {Object} Résultat avec scores mis à jour
   */
  validateAnswer(game, playerId, isCorrect) {
    const round = game.currentRound;
    const player = game.getPlayer(playerId);

    if (!round || !player) {
      throw new Error('Round ou joueur invalide');
    }

    let pointsAwarded = 0;
    let result = {};

    switch (game.mode) {
      case GAME_MODES.ACCUMUL_POINTS:
        pointsAwarded = scoringEngine.calculateAccumulPoints(isCorrect);
        player.score += pointsAwarded;
        result = {
          playerId,
          playerName: player.name,
          isCorrect,
          pointsAwarded,
          newScore: player.score
        };
        break;

      case GAME_MODES.REFLEXOQUIZ:
        const buzzOrder = round.buzzOrder;
        const buzzPosition = buzzOrder.findIndex(b => b.playerId === playerId) + 1;
        pointsAwarded = scoringEngine.calculateReflexoQuiz(isCorrect, buzzPosition);
        player.score += pointsAwarded;
        result = {
          playerId,
          playerName: player.name,
          isCorrect,
          pointsAwarded,
          buzzPosition,
          newScore: player.score
        };
        break;

      case GAME_MODES.QUESTIONS_RAFALE:
        const buzzTime = round.buzzOrder.find(b => b.playerId === playerId)?.timestamp;
        pointsAwarded = scoringEngine.calculateQuestionsRafale(
          isCorrect,
          buzzTime,
          round.startTime
        );
        player.score += pointsAwarded;
        result = {
          playerId,
          playerName: player.name,
          isCorrect,
          pointsAwarded,
          responseTime: (buzzTime - round.startTime) / 1000,
          newScore: player.score
        };
        break;

      case GAME_MODES.CHAUD_DEVANT:
        const eventType = isCorrect ? 'pass' : 'keep';
        pointsAwarded = scoringEngine.calculateChaudDevant(eventType);
        player.score += pointsAwarded;

        if (isCorrect) {
          // Passer la bombe à un autre joueur
          const otherPlayers = game.getPlayersArray().filter(p => p.id !== playerId);
          const nextPlayer = otherPlayers[Math.floor(Math.random() * otherPlayers.length)];
          round.setBombHolder(nextPlayer?.id);
        }

        result = {
          playerId,
          playerName: player.name,
          isCorrect,
          pointsAwarded,
          newScore: player.score,
          newBombHolder: round.bombHolder
        };
        break;

      case GAME_MODES.TUEURS_GAGES:
        const { attackerPoints, stolenPoints } = scoringEngine.calculateTueursGages(isCorrect);
        player.score += attackerPoints;

        let targetPlayer = null;
        if (isCorrect && round.selectedTarget) {
          targetPlayer = game.getPlayer(round.selectedTarget);
          if (targetPlayer) {
            targetPlayer.score -= stolenPoints;
          }
        }

        result = {
          playerId,
          playerName: player.name,
          isCorrect,
          pointsAwarded: attackerPoints,
          newScore: player.score,
          target: targetPlayer ? {
            id: targetPlayer.id,
            name: targetPlayer.name,
            pointsStolen: stolenPoints,
            newScore: targetPlayer.score
          } : null
        };
        break;

      default:
        throw new Error(`Mode ${game.mode} non supporté`);
    }

    round.result = result;
    round.end();

    logger.info('Answer validated', {
      roomCode: game.roomCode,
      mode: game.mode,
      ...result
    });

    const teamLeaderboard = game.getTeamLeaderboard();
    console.log('📊 SCORES MIS À JOUR:', {
      player: player.name,
      newScore: player.score,
      pointsAwarded,
      teamLeaderboard: teamLeaderboard.map(t => ({ name: t.name, score: t.score }))
    });

    return {
      ...result,
      correctAnswer: `${round.track.name} - ${round.track.artists[0].name}`,
      leaderboard: game.getLeaderboard(),
      teamLeaderboard: teamLeaderboard
    };
  }

  /**
   * Valide toutes les réponses QCM
   * @param {Game} game
   * @returns {Object}
   */
  validateQCMAnswers(game) {
    const round = game.currentRound;

    if (!round || !round.qcm) {
      throw new Error('Pas de QCM actif');
    }

    const results = [];
    const correctOptionIndex = round.qcm.options.findIndex(opt => opt.correct);

    // Évaluer chaque réponse
    for (const player of game.getPlayersArray()) {
      const answer = round.getAnswer(player.id);

      if (answer) {
        const isCorrect = answer.optionIndex === correctOptionIndex;
        const pointsAwarded = scoringEngine.calculateQCM(isCorrect);
        player.score += pointsAwarded;

        results.push({
          playerId: player.id,
          playerName: player.name,
          answer: round.qcm.options[answer.optionIndex].text,
          isCorrect,
          pointsAwarded,
          newScore: player.score
        });
      }
    }

    round.result = { results };
    round.end();

    logger.info('QCM answers validated', {
      roomCode: game.roomCode,
      totalAnswers: results.length
    });

    return {
      results,
      correctAnswer: round.qcm.correctAnswer,
      correctOption: round.qcm.options[correctOptionIndex].text,
      leaderboard: game.getLeaderboard(),
      teamLeaderboard: game.getTeamLeaderboard()
    };
  }

  /**
   * Gère l'explosion de la bombe (mode Chaud Devant)
   * @param {Game} game
   * @returns {Object}
   */
  handleBombExplosion(game) {
    const round = game.currentRound;

    if (!round || !round.bombHolder) {
      throw new Error('Pas de bombe active');
    }

    const victim = game.getPlayer(round.bombHolder);
    if (victim) {
      const pointsLost = Math.abs(SCORING_CONFIGS.chaud_devant.explosion);
      victim.score += SCORING_CONFIGS.chaud_devant.explosion;

      logger.info('Bomb exploded', {
        roomCode: game.roomCode,
        victimId: victim.id,
        victimName: victim.name,
        pointsLost
      });

      round.result = {
        bombExploded: true,
        victimId: victim.id,
        victimName: victim.name,
        pointsLost,
        newScore: victim.score
      };
    }

    round.end();

    return {
      ...round.result,
      leaderboard: game.getLeaderboard(),
      teamLeaderboard: game.getTeamLeaderboard()
    };
  }

  /**
   * Sélectionne une cible (mode Tueurs à Gages)
   * @param {Game} game
   * @param {string} targetId
   */
  selectTarget(game, targetId) {
    const round = game.currentRound;

    if (!round) {
      throw new Error('Aucun round actif');
    }

    const target = game.getPlayer(targetId);
    if (!target) {
      throw new Error('Cible invalide');
    }

    round.setTarget(targetId);

    logger.info('Target selected', {
      roomCode: game.roomCode,
      targetId,
      targetName: target.name
    });
  }

  /**
   * Termine un round (skip)
   * @param {Game} game
   * @returns {Object}
   */
  skipRound(game) {
    const round = game.currentRound;

    if (!round) {
      throw new Error('Aucun round actif');
    }

    round.end();
    game.status = GAME_STATUS.WAITING;

    logger.info('Round skipped', {
      roomCode: game.roomCode,
      roundNumber: game.roundNumber
    });

    return {
      skipped: true,
      correctAnswer: `${round.track.name} - ${round.track.artists[0].name}`,
      leaderboard: game.getLeaderboard(),
      teamLeaderboard: game.getTeamLeaderboard()
    };
  }
}

module.exports = new GameEngine();
