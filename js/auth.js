(function() {
  const correctPassword = '310823';
  const authKey = 'timeTogetherAuth';
  const lockoutKey = 'timeTogetherLockout';
  const attemptsKey = 'timeTogetherAttempts';

  const passcodeScreen = document.getElementById('passcode-screen');
  const mainContent = document.querySelector('main'); // Assuming main content is in <main>

  // If authenticated, hide the passcode screen and ensure main content is visible.
  if (localStorage.getItem(authKey) === 'true') {
    if(passcodeScreen) passcodeScreen.style.display = 'none';
    if(mainContent) mainContent.style.display = 'flex';
    return;
  }
  
  // If not authenticated, ensure passcode screen is visible and main content is hidden.
  if(passcodeScreen) passcodeScreen.style.display = 'flex';
  if(mainContent) mainContent.style.display = 'none';

  const dots = document.querySelectorAll('.dot');
  const keypad = document.querySelector('.passcode-keypad');
  const statusEl = document.querySelector('.passcode-status');

  let enteredPasscode = '';

  const updateDots = () => {
    dots.forEach((dot, index) => {
      dot.classList.toggle('filled', index < enteredPasscode.length);
    });
  };

  const resetPasscode = () => {
    enteredPasscode = '';
    updateDots();
  };

  const showPasscodeError = (message) => {
    statusEl.textContent = message;
    const dotsContainer = document.querySelector('.passcode-dots');
    dotsContainer.classList.add('shake');
    setTimeout(() => {
      dotsContainer.classList.remove('shake');
      resetPasscode();
    }, 500);
  };
  
  const handleSuccessfulAuth = () => {
    localStorage.setItem(authKey, 'true');
    sessionStorage.removeItem(lockoutKey);
    sessionStorage.removeItem(attemptsKey);
    passcodeScreen.style.display = 'none';
    if(mainContent) mainContent.style.display = 'flex';
  };

  const handleKeypress = (key) => {
    if (statusEl.textContent) statusEl.textContent = '';

    if (key === 'delete') {
      enteredPasscode = enteredPasscode.slice(0, -1);
    } else if (enteredPasscode.length < 6) {
      enteredPasscode += key;
    }

    updateDots();

    if (enteredPasscode.length === 6) {
      checkPassword();
    }
  };

  const checkPassword = () => {
    if (enteredPasscode === correctPassword) {
      handleSuccessfulAuth();
    } else {
      let failedAttempts = parseInt(sessionStorage.getItem(attemptsKey) || '0') + 1;
      sessionStorage.setItem(attemptsKey, failedAttempts);

      let lockoutDuration = 0; // in minutes
      if (failedAttempts >= 10) {
        lockoutDuration = 30;
      } else if (failedAttempts >= 5) {
        lockoutDuration = 5;
      } else if (failedAttempts >= 3) {
        lockoutDuration = 1;
      }

      if (lockoutDuration > 0) {
        const lockoutUntil = Date.now() + lockoutDuration * 60 * 1000;
        sessionStorage.setItem(lockoutKey, JSON.stringify({ until: lockoutUntil }));
        showPasscodeError(`Thử lại sau ${lockoutDuration} phút`);
      } else {
        showPasscodeError('Mật khẩu sai');
      }
    }
  };

  const init = () => {
    // Check for lockout
    const lockoutInfo = JSON.parse(sessionStorage.getItem(lockoutKey) || '{}');
    if (lockoutInfo.until && Date.now() < lockoutInfo.until) {
      const minutesLeft = Math.ceil((lockoutInfo.until - Date.now()) / 60000);
      statusEl.textContent = `Thử lại sau ${minutesLeft} phút`;
      keypad.style.display = 'none'; // Hide keypad if locked out
      return; 
    }

    keypad.addEventListener('click', (e) => {
      const button = e.target.closest('.keypad-button');
      if (button) {
        const key = button.dataset.key;
        handleKeypress(key);
      }
    });
  };

  // Run the script
  init();
})();