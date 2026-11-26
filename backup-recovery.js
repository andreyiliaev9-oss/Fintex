/* Run before app state is read. A failed/interrupted multi-key restore rolls back. */
(() => {
  try{window.FintexBackupRecovered=FintexBackupModel.recover(localStorage);}
  catch(error){window.FintexBackupRecoveryError=true;console.error('Fintex: restore recovery requires available local storage.');}
})();
