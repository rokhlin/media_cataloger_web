import { describe, it } from 'node:test';
import assert from 'node:assert';
import { translations } from '../../../i18n/translations.js';
import AdminBackupTab from '../AdminBackupTab.js';

describe('AdminBackupTab & Translations', () => {
  it('should export AdminBackupTab component', () => {
    assert.strictEqual(typeof AdminBackupTab, 'function');
  });

  it('should have all backup translation keys defined in English dictionary', () => {
    const en = translations.en;
    assert.strictEqual(en.adminTabBackups, 'System Backups');
    assert.ok(en.backupSectionTitle);
    assert.ok(en.backupBtnCreateNow);
    assert.ok(en.backupBtnUpload);
    assert.ok(en.backupScheduleTitle);
    assert.ok(en.backupRestoreModalTitle);
    assert.ok(en.backupConfirmDelete);
  });

  it('should have all backup translation keys defined in Russian dictionary', () => {
    const ru = translations.ru;
    assert.strictEqual(ru.adminTabBackups, 'Резервные копии');
    assert.ok(ru.backupSectionTitle);
    assert.ok(ru.backupBtnCreateNow);
    assert.ok(ru.backupBtnUpload);
    assert.ok(ru.backupScheduleTitle);
    assert.ok(ru.backupRestoreModalTitle);
    assert.ok(ru.backupConfirmDelete);
  });
});
