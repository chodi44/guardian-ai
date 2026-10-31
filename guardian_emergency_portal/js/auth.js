export const authenticateOperator = async (terminalId, accessPhrase, totp) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Allow default credentials or any user-entered credentials
      if (!terminalId || terminalId.trim().length === 0) {
        resolve({ success: false, error: 'Terminal ID is required' });
      } else {
        resolve({
          success: true,
          data: {
            terminalId: terminalId.includes('@') ? terminalId : 'TRM-8492',
            enclave: 'Sector 4 South Command',
            clearanceLevel: 3,
            operator: 'Inspector Sarah Connor (OP-8492)'
          },
        });
      }
    }, 400);
  });
};
