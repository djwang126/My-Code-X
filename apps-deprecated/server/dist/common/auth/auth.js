export function isAuthorized(request, authToken) {
    if (!authToken)
        return true;
    const header = String(request.headers.authorization || '');
    return header === `Bearer ${authToken}`;
}
//# sourceMappingURL=auth.js.map