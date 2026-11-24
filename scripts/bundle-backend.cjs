/* Phone-friendly single-file Apps Script installer, generated from source modules. */
const fs=require('node:fs'),path=require('node:path'),root=path.join(__dirname,'..');
const header=`/** FINTEX v7 — единый сервер без паролей/PIN, с добровольными напоминаниями.
 * Замените весь Code.gs этим файлом; не оставляйте дубли Auth/Reminders/ReminderModel.gs.
 * Существующую таблицу и свойства скрипта сохраняйте, новую базу создавать не нужно.
 * Для напоминаний один раз запустите setupFintexReminders от имени владельца.
 * После сохранения обновите версию текущего развёртывания, сохранив /exec URL.
 */\n`;
const body=header+['Auth.gs','ReminderModel.gs','Reminders.gs','Code.gs'].map(name=>fs.readFileSync(path.join(root,'backend',name),'utf8').trimEnd()).join('\n\n')+'\n';
for(const name of ['Fintex-Code.gs','Fintex-Code.txt'])fs.writeFileSync(path.join(root,'downloads',name),body);
