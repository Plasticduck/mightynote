// Shared client-side auth helper for MightyOps.
//
// Login stores a bearer token (mightyops_token) alongside the user object;
// every protected API call must send it. Use window.authFetch() instead of
// fetch() for any /.netlify/functions/ call that now requires auth — it adds
// the Authorization header and, on a 401 (expired/invalid token), clears the
// session and bounces to the login page so the user simply signs in again.

(function () {
    var TOKEN_KEY = 'mightyops_token';
    var USER_KEY = 'mightyops_user';

    function getToken() {
        return localStorage.getItem(TOKEN_KEY);
    }

    function clearSession() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    }

    function redirectToLogin() {
        if (!/login\.html$/.test(window.location.pathname)) {
            window.location.href = 'login.html';
        }
    }

    // fetch() wrapper that attaches the bearer token and handles auth failures.
    async function authFetch(input, init) {
        init = init || {};
        var headers = new Headers(init.headers || {});
        var token = getToken();
        if (token) headers.set('Authorization', 'Bearer ' + token);
        init.headers = headers;

        var res = await fetch(input, init);
        if (res.status === 401) {
            // Token missing/expired — force a fresh sign-in.
            clearSession();
            redirectToLogin();
        }
        return res;
    }

    window.getAuthToken = getToken;
    window.clearAuthSession = clearSession;
    window.authFetch = authFetch;
})();
