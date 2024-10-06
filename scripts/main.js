// Helper function to calculate the distance between two tokens
function calculateDistance(tokenA, tokenB) {
  const dx = tokenA.x - tokenB.x;
  const dy = tokenA.y - tokenB.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Function to get a random action from the NPC's list of actions, returning its UUID as well
function getRandomAction(npc) {
  // Get the NPC's available actions (attacks, spells, abilities)
  const actions = npc.actor.items.filter(item => {
    // Only return usable actions (like weapon attacks, spells, abilities)
    return item.type === "weapon" || item.type === "spell";
  });

  if (actions.length === 0) {
    console.warn(`${npc.name} has no available combat actions.`);
    return null; // No available actions
  }

  // Pick a random action from the available ones
  const randomIndex = Math.floor(Math.random() * actions.length);
  const action = actions[randomIndex];

  // Return both action name and UUID
  return { name: action.name, uuid: action.uuid };
}

// Suggest action for each NPC based on the nearest player
function suggestActionForNPC(npc, players) {
  let closestPlayer = null;
  let minDistance = Infinity;

  players.forEach(player => {
    const distance = calculateDistance(npc, player);
    if (distance < minDistance) {
      minDistance = distance;
      closestPlayer = player;
    }
  });

  // If there's no player to target, return
  if (!closestPlayer) return null;

  // First action: Move towards the closest player
  const moveAction = `Move towards ${closestPlayer.name}`;
  
  // Get a random action from the NPC's available actions
  const randomAction = getRandomAction(npc);
  if (!randomAction) return null;

  const actionMessage = `${randomAction.name}`;
  const actionUuid = randomAction.uuid;

  // Return both actions and UUID
  return { moveAction, actionMessage, target: closestPlayer, actionUuid };
}

// Function to send a whisper to the GM with NPC action suggestions, including UUID and speed
function sendNpcActionMessage(npc, moveAction, actionMessage, target, actionUuid) {
  // Retrieve the NPC's speed from the actor data
  const speed = npc.actor.system.attributes.movement.walk || "unknown speed";

  let message = `${npc.name} will ${moveAction} with a speed of ${speed}.`;

  if (actionMessage) {
    // Embedding the action link within the action message
    const actionLink = `@UUID[${actionUuid}]{${actionMessage}}`;
    message += ` Then, they will use ${actionLink} on ${target.name}. (if within range)`;
  }

  ChatMessage.create({
    content: message,
    whisper: ChatMessage.getWhisperRecipients("GM") // Whisper to the GM
  });
}

// Hook into the combat tracker to suggest actions on NPC turns
Hooks.on("updateCombat", (combat, updateData, options, userId) => {
  // Check if the current combatant is an NPC
  const currentCombatant = combat.combatant.token;
  if (!currentCombatant || currentCombatant.actor.type !== "npc") return;

  // Get all players and NPCs on the scene
  const { players, npcs } = getTokens();

  // Find the current NPC token in the list
  const currentNpc = npcs.find(npc => npc.id === currentCombatant.id);
  if (!currentNpc) return;

  // Suggest actions for the NPC
  const suggestion = suggestActionForNPC(currentNpc, players);
  if (suggestion) {
    sendNpcActionMessage(currentNpc, suggestion.moveAction, suggestion.actionMessage, suggestion.target, suggestion.actionUuid);
  }
});

// Function to get all player and NPC tokens on the current scene
function getTokens() {
  let players = [];
  let npcs = [];
  
  canvas.tokens.placeables.forEach(token => {
    // Access token.actor.type and token.actor.system
    if (token.actor?.type === "npc") {
      npcs.push(token);
    } else if (token.actor?.type === "character") {
      players.push(token);
    }
  });
  
  return { players, npcs };
}
