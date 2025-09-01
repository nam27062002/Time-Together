(function() {
  const authKey = 'timeTogetherAuth';
  if (!localStorage.getItem(authKey)) {
    window.location.href = 'login.html';
  }
})();