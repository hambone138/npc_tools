// Function to get tokens on the map
function getTokens() {
  let players = [];
  let npcs = [];
  
  canvas.tokens.placeables.forEach(token => {
    if (token.actor.data.type === "npc") {
      npcs.push(token);
    } else if (token.actor.data.type === "character") {
      players.push(token);
    }
  });
  return { players, npcs };
}

// Function to get tokens on the map
function getTokens() {
  let players = [];
  let npcs = [];
  
  canvas.tokens.placeables.forEach(token => {
    if (token.actor.data.type === "npc") {
      npcs.push(token);
    } else if (token.actor.data.type === "character") {
      players.push(token);
    }
  });
  return { players, npcs };
}
// Function to calculate distance between two tokens
function calculateDistance(token1, token2) {
  let dx = token1.x - token2.x;
  let dy = token1.y - token2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Suggest an action for each NPC
function suggestActionForNPC(npc, players) {
  let closestPlayer = null;
  let minDistance = Infinity;
  
  players.forEach(player => {
    let distance = calculateDistance(npc, player);
    if (distance < minDistance) {
      minDistance = distance;
      closestPlayer = player;
    }
  });
  
  let action = minDistance <= 30 ? 'Attack' : 'Move towards';
  return { action, target: closestPlayer };
}
// Function to send the NPC action suggestion to the DM
function sendMessage(npc, action, target) {
  let message = `${npc.name} will ${action} ${target.name}.`;
  ChatMessage.create({
    content: message,
    whisper: ChatMessage.getWhisperRecipients("GM")
  });
}

// Hook into the start of each combat turn
Hooks.on("updateCombat", (combat, changed, options, userId) => {
  if (combat.combatant && combat.combatant.token) {
    let currentToken = canvas.tokens.get(combat.combatant.token._id);
    if (currentToken.actor.data.type === "npc") {
      let { players, npcs } = getTokens();
      let action = suggestActionForNPC(currentToken, players);
      sendMessage(currentToken, action.action, action.target);
    }
  }
});
