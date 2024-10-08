// Object to store NPC targets by NPC ID
let npcTargets = {};

// Helper function to calculate the distance between two tokens
function calculateDistance(tokenA, tokenB) {
  const dx = tokenA.x - tokenB.x;
  const dy = tokenA.y - tokenB.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Function to get a random action from the NPC's list of actions, returning its UUID as well
function getRandomAction(npc) {
  const actions = npc.actor.items.filter(item => {
    return item.type === "weapon" || item.type === "spell";
  });

  if (actions.length === 0) {
    console.warn(`${npc.name} has no available combat actions.`);
    return null;
  }

  const randomIndex = Math.floor(Math.random() * actions.length);
  const action = actions[randomIndex];

  return { name: action.name, uuid: action.uuid };
}

// Helper function to format the NPC's attributes
function formatAttributes(npc) {
  const attributes = npc.actor.system.abilities;
  const formattedAttributes = Object.entries(attributes)
    .map(([key, value]) => {
      const mod = value.mod;
      return `${key.toUpperCase()}: ${mod >= 0 ? '+' : ''}${mod}`;
    })
    .join(' ');
  
  return formattedAttributes;
}

// Helper function to calculate movement in grids
function calculateMovementSpaces(npc) {
  const movementSpeed = npc.actor.system.attributes.movement.walk;
  return Math.floor(movementSpeed / 5); // Each grid is 5 ft
}

// Function to suggest an action for each NPC based on their current or nearest player target and intelligence attribute
function suggestActionForNPC(npc, players) {
  let targetPlayer = npcTargets[npc.id]; // Check if this NPC already has a target
  const intelligence = npc.actor.system.abilities.int.value;

  // If there is no target or the target is no longer present, find a new one
  if (!targetPlayer || !players.some(player => player.id === targetPlayer.id)) {
    targetPlayer = findClosestPlayer(npc, players);
    npcTargets[npc.id] = targetPlayer; // Update the target for future rounds

    // Log to console when a new target is assigned
    if (targetPlayer) {
      console.log(`${npc.name} has selected a new target: ${targetPlayer.name}`);
    }
  }

  if (!targetPlayer) return null;

  // Determine NPC's reaction based on intelligence
  let reactionMessage = '';
  if (intelligence <= 4) {
    // Intelligence 1-4: Attacks the closest target
    reactionMessage = 'Attacks the closest target';
  } else if (intelligence <= 7) {
    // Intelligence 5-7: Uses ranged attack if available
    const rangedActions = npc.actor.items.filter(item => 
      (item.type === "weapon" || item.type === "spell") && item.system.range.value > 5
    );
    
    if (rangedActions.length > 0) {
      reactionMessage = 'Uses a ranged attack';
    } else {
      reactionMessage = 'Attacks the closest target due to lack of ranged options';
    }
  } else {
    // Intelligence 8+: Has a chance to switch targets to aid a low-health NPC or flee if below 75% health
    const otherNpcs = getTokens().npcs.filter(otherNpc => otherNpc.id !== npc.id);
    const npcHealth = npc.actor.system.attributes.hp.value;
    const npcMaxHealth = npc.actor.system.attributes.hp.max;
    
    // Check for any NPCs with low health to possibly aid
    const lowHealthNpcs = otherNpcs.filter(otherNpc => 
      otherNpc.actor.system.attributes.hp.value < otherNpc.actor.system.attributes.hp.max * 0.25
    );

    if (lowHealthNpcs.length > 0 && Math.random() > 0.5) {
      const allyToAid = lowHealthNpcs[Math.floor(Math.random() * lowHealthNpcs.length)];
      targetPlayer = findClosestPlayer(allyToAid, players);
      reactionMessage = `Switches target to aid ${allyToAid.name} who is at low health`;
    } else if (npcHealth < npcMaxHealth * 0.75) {
      reactionMessage = 'Attempts to flee due to low health';
    } else {
      reactionMessage = 'Attacks the closest target';
    }
  }

  const moveSpaces = calculateMovementSpaces(npc);
  const moveAction = `Move (${moveSpaces}) towards ${targetPlayer.name}`;
  const randomAction = getRandomAction(npc);
  if (!randomAction) return null;

  return { moveAction, actionMessage: randomAction.name, target: targetPlayer, actionUuid: randomAction.uuid, reactionMessage };
}

// Helper function to find the closest player to an NPC
function findClosestPlayer(npc, players) {
  let closestPlayer = null;
  let minDistance = Infinity;

  players.forEach(player => {
    const distance = calculateDistance(npc, player);
    if (distance < minDistance) {
      minDistance = distance;
      closestPlayer = player;
    }
  });

  return closestPlayer;
}

// Function to send a whisper to the GM with NPC action suggestions, including UUID, attributes, movement, and reaction
function sendNpcActionMessage(npc, moveAction, actionMessage, target, actionUuid, reactionMessage) {
  let message = `${npc.name} will ${moveAction}.`;

  if (actionMessage) {
    const actionLink = `@UUID[${actionUuid}]{${actionMessage}}`;
    message += ` Then, they will use ${actionLink} on ${target.name}. (if within range)`;
  }

  const attributes = formatAttributes(npc);
  message += `\nAttributes: ${attributes}`;
  message += `\nReaction: ${reactionMessage}`;

  ChatMessage.create({
    content: message,
    whisper: ChatMessage.getWhisperRecipients("GM")
  });
}

// Hook into the combat tracker to suggest actions on NPC turns
Hooks.on("updateCombat", (combat, updateData, options, userId) => {
  const currentCombatant = combat.combatant.token;
  if (!currentCombatant || currentCombatant.actor.type !== "npc") return;

  const { players, npcs } = getTokens();
  const currentNpc = npcs.find(npc => npc.id === currentCombatant.id);
  if (!currentNpc) return;

  const suggestion = suggestActionForNPC(currentNpc, players);
  if (suggestion) {
    sendNpcActionMessage(currentNpc, suggestion.moveAction, suggestion.actionMessage, suggestion.target, suggestion.actionUuid, suggestion.reactionMessage);
  }
});

// Function to get all player and NPC tokens on the current scene
function getTokens() {
  let players = [];
  let npcs = [];

  canvas.tokens.placeables.forEach(token => {
    if (token.actor?.type === "npc") {
      npcs.push(token);
    } else if (token.actor?.type === "character") {
      players.push(token);
    }
  });

  return { players, npcs };
}

// Hook to log npcTargets and clear it once combat ends
Hooks.on("deleteCombat", () => {
  console.log("NPC Targets at the end of combat:", npcTargets);
  npcTargets = {}; // Clear the object for the next combat
});
