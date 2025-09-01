(function() {
      const correctPassword = '310823';
      const authKey = 'timeTogetherAuth';
      const lockoutKey = 'timeTogetherLockout';
      const attemptsKey = 'timeTogetherAttempts';

      const hideContent = () => {
        document.body.innerHTML = '<div style="text-align: center; padding: 50px; color: white; font-family: sans-serif; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; background-color: #111;"><h1>TRUY CẬP BỊ TỪ CHỐI</h1><p>Mật khẩu không chính xác hoặc bạn đang bị khóa. Vui lòng tải lại trang và thử lại sau.</p></div>';
      };
      
      if (localStorage.getItem(authKey) === 'true') {
        return;
      }

      const lockoutInfo = JSON.parse(sessionStorage.getItem(lockoutKey) || '{}');
      if (lockoutInfo.until && Date.now() < lockoutInfo.until) {
        const minutesLeft = Math.ceil((lockoutInfo.until - Date.now()) / 60000);
        alert(`Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau ${minutesLeft} phút.`);
        hideContent();
        return;
      }

      const enteredPassword = prompt('❤️ Vui lòng nhập mật khẩu để vào nhé:');

      if (enteredPassword === correctPassword) {
        localStorage.setItem(authKey, 'true');
        sessionStorage.removeItem(lockoutKey);
        sessionStorage.removeItem(attemptsKey);
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
          alert(`Mật khẩu sai. Bạn đã bị khóa trong ${lockoutDuration} phút.`);
        } else {
          alert('Mật khẩu sai. Vui lòng thử lại.');
        }
        
        hideContent();
      }
    })();