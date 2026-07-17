const access = window.DoseSupplierAccess;
const byId = (id) => document.getElementById(id);

let currentSession = null;
let currentSettings = null;
let redirecting = false;

function getNextTarget() {
  const target = new URLSearchParams(window.location.search).get('next') || '';
  return ['russo', 'pagnottella'].includes(target) ? target : '';
}

function resolveTargetHref(target) {
  if (target === 'pagnottella') return './pagnottella/?store=pagnottella';
  return './russo/';
}

function setAuthButtonsDisabled(disabled) {
  ['