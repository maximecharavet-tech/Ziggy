// Replaces claims the product cannot back (COPPA certification, end-to-end
// encryption, "no personal data collected") with ones it can, and adds the
// account-deletion strings. Idempotent.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'messages');

const L = {
  fr: {
    trust: { eu_storage: 'Données stockées en Europe', encrypted: 'Connexion chiffrée', no_ads: 'Zéro publicité', parent_account: 'Compte géré par le parent' },
    safe_space: 'Un espace sûr', safe_space_desc: 'Sans publicité, données stockées en Europe, compte géré par un parent. Nous ne gardons que le prénom de l’enfant.',
    a1: 'Ziggy est pensé pour les enfants : aucune publicité, aucun échange avec des inconnus, et le compte est créé et géré par un parent. Nous ne conservons que le prénom de l’enfant, sa tranche d’âge et ses résultats de jeu, stockés en Europe. Le compte peut être supprimé à tout moment depuis l’espace parent.',
    account: { deleteTitle: 'Supprimer le compte', deleteText: 'Efface définitivement le compte, le profil de l’enfant et tous ses résultats. Cette action est irréversible.', deleteButton: 'Supprimer définitivement', deleteConfirm: 'Tapez SUPPRIMER pour confirmer', deleteWord: 'SUPPRIMER', deleting: 'Suppression…', deleteError: 'La suppression a échoué. Réessayez ou contactez-nous.' },
  },
  en: {
    trust: { eu_storage: 'Data stored in Europe', encrypted: 'Encrypted connection', no_ads: 'Zero ads', parent_account: 'Parent-managed account' },
    safe_space: 'A safe space', safe_space_desc: 'No ads, data stored in Europe, an account run by a parent. We only keep your child’s first name.',
    a1: 'Ziggy is built for children: no ads, no contact with strangers, and the account is created and managed by a parent. We only keep the child’s first name, age range and game results, stored in Europe. The account can be deleted at any time from the parent area.',
    account: { deleteTitle: 'Delete the account', deleteText: 'Permanently erases the account, the child’s profile and all their results. This cannot be undone.', deleteButton: 'Delete permanently', deleteConfirm: 'Type DELETE to confirm', deleteWord: 'DELETE', deleting: 'Deleting…', deleteError: 'Deletion failed. Please try again or contact us.' },
  },
  es: {
    trust: { eu_storage: 'Datos guardados en Europa', encrypted: 'Conexión cifrada', no_ads: 'Cero anuncios', parent_account: 'Cuenta gestionada por la familia' },
    safe_space: 'Un espacio seguro', safe_space_desc: 'Sin anuncios, datos guardados en Europa y una cuenta gestionada por un adulto. Solo guardamos el nombre del niño.',
    a1: 'Ziggy está pensado para niños: sin anuncios, sin contacto con desconocidos, y la cuenta la crea y gestiona un adulto. Solo guardamos el nombre del niño, su franja de edad y sus resultados, almacenados en Europa. La cuenta se puede borrar en cualquier momento desde el espacio de la familia.',
    account: { deleteTitle: 'Eliminar la cuenta', deleteText: 'Borra para siempre la cuenta, el perfil del niño y todos sus resultados. No se puede deshacer.', deleteButton: 'Eliminar definitivamente', deleteConfirm: 'Escribe ELIMINAR para confirmar', deleteWord: 'ELIMINAR', deleting: 'Eliminando…', deleteError: 'No se ha podido eliminar. Inténtalo de nuevo o contáctanos.' },
  },
  de: {
    trust: { eu_storage: 'Daten in Europa gespeichert', encrypted: 'Verschlüsselte Verbindung', no_ads: 'Keine Werbung', parent_account: 'Von Eltern verwaltetes Konto' },
    safe_space: 'Ein sicherer Ort', safe_space_desc: 'Keine Werbung, Daten in Europa, ein Konto in Elternhand. Wir speichern nur den Vornamen Ihres Kindes.',
    a1: 'Ziggy ist für Kinder gemacht: keine Werbung, kein Kontakt zu Fremden, und das Konto wird von einem Elternteil angelegt und verwaltet. Wir speichern nur den Vornamen, die Altersgruppe und die Spielergebnisse – in Europa. Das Konto lässt sich jederzeit im Elternbereich löschen.',
    account: { deleteTitle: 'Konto löschen', deleteText: 'Löscht das Konto, das Profil des Kindes und alle Ergebnisse endgültig. Das kann nicht rückgängig gemacht werden.', deleteButton: 'Endgültig löschen', deleteConfirm: 'Zur Bestätigung LÖSCHEN eingeben', deleteWord: 'LÖSCHEN', deleting: 'Wird gelöscht…', deleteError: 'Löschen fehlgeschlagen. Bitte erneut versuchen oder uns kontaktieren.' },
  },
  pt: {
    trust: { eu_storage: 'Dados guardados na Europa', encrypted: 'Ligação cifrada', no_ads: 'Zero anúncios', parent_account: 'Conta gerida por um adulto' },
    safe_space: 'Um espaço seguro', safe_space_desc: 'Sem anúncios, dados guardados na Europa e uma conta gerida por um adulto. Só guardamos o nome da criança.',
    a1: 'O Ziggy foi pensado para crianças: sem anúncios, sem contacto com desconhecidos, e a conta é criada e gerida por um adulto. Guardamos apenas o nome da criança, a faixa etária e os resultados dos jogos, na Europa. A conta pode ser apagada a qualquer momento no espaço do adulto.',
    account: { deleteTitle: 'Apagar a conta', deleteText: 'Apaga para sempre a conta, o perfil da criança e todos os resultados. Não é possível desfazer.', deleteButton: 'Apagar definitivamente', deleteConfirm: 'Escreva APAGAR para confirmar', deleteWord: 'APAGAR', deleting: 'A apagar…', deleteError: 'Não foi possível apagar. Tente novamente ou contacte-nos.' },
  },
  it: {
    trust: { eu_storage: 'Dati conservati in Europa', encrypted: 'Connessione cifrata', no_ads: 'Zero pubblicità', parent_account: 'Account gestito dal genitore' },
    safe_space: 'Uno spazio sicuro', safe_space_desc: 'Niente pubblicità, dati conservati in Europa, un account gestito da un genitore. Conserviamo solo il nome del bambino.',
    a1: 'Ziggy è pensato per i bambini: niente pubblicità, nessun contatto con sconosciuti, e l’account è creato e gestito da un genitore. Conserviamo solo il nome del bambino, la fascia d’età e i risultati dei giochi, in Europa. L’account si può eliminare in qualsiasi momento dall’area genitori.',
    account: { deleteTitle: 'Elimina l’account', deleteText: 'Cancella definitivamente l’account, il profilo del bambino e tutti i risultati. Non si può annullare.', deleteButton: 'Elimina definitivamente', deleteConfirm: 'Scrivi ELIMINA per confermare', deleteWord: 'ELIMINA', deleting: 'Eliminazione…', deleteError: 'Eliminazione non riuscita. Riprova o contattaci.' },
  },
  nl: {
    trust: { eu_storage: 'Gegevens in Europa opgeslagen', encrypted: 'Versleutelde verbinding', no_ads: 'Nul reclame', parent_account: 'Account beheerd door ouder' },
    safe_space: 'Een veilige plek', safe_space_desc: 'Geen reclame, gegevens in Europa, een account in handen van een ouder. We bewaren alleen de voornaam van je kind.',
    a1: 'Ziggy is gemaakt voor kinderen: geen reclame, geen contact met onbekenden, en het account wordt aangemaakt en beheerd door een ouder. We bewaren alleen de voornaam, de leeftijdsgroep en de spelresultaten, in Europa. Het account kan op elk moment worden verwijderd in de ouderomgeving.',
    account: { deleteTitle: 'Account verwijderen', deleteText: 'Verwijdert het account, het profiel van het kind en alle resultaten definitief. Dit kan niet ongedaan worden gemaakt.', deleteButton: 'Definitief verwijderen', deleteConfirm: 'Typ VERWIJDEREN om te bevestigen', deleteWord: 'VERWIJDEREN', deleting: 'Verwijderen…', deleteError: 'Verwijderen mislukt. Probeer opnieuw of neem contact op.' },
  },
  tr: {
    trust: { eu_storage: 'Veriler Avrupa’da saklanır', encrypted: 'Şifreli bağlantı', no_ads: 'Sıfır reklam', parent_account: 'Veli tarafından yönetilen hesap' },
    safe_space: 'Güvenli bir alan', safe_space_desc: 'Reklam yok, veriler Avrupa’da, hesap bir veli tarafından yönetilir. Yalnızca çocuğunuzun adını saklarız.',
    a1: 'Ziggy çocuklar için tasarlandı: reklam yok, yabancılarla iletişim yok ve hesabı bir veli oluşturur ve yönetir. Yalnızca çocuğun adını, yaş grubunu ve oyun sonuçlarını Avrupa’da saklarız. Hesap, veli alanından istenildiği zaman silinebilir.',
    account: { deleteTitle: 'Hesabı sil', deleteText: 'Hesabı, çocuğun profilini ve tüm sonuçlarını kalıcı olarak siler. Geri alınamaz.', deleteButton: 'Kalıcı olarak sil', deleteConfirm: 'Onaylamak için SİL yazın', deleteWord: 'SİL', deleting: 'Siliniyor…', deleteError: 'Silme başarısız oldu. Tekrar deneyin veya bize ulaşın.' },
  },
  ja: {
    trust: { eu_storage: 'データはヨーロッパで保管', encrypted: '暗号化された通信', no_ads: '広告ゼロ', parent_account: '保護者が管理するアカウント' },
    safe_space: '安心できる場所', safe_space_desc: '広告なし、データはヨーロッパで保管、アカウントは保護者が管理。保存するのはお子さまの名前だけです。',
    a1: 'ジギーは子ども向けに作られています。広告なし、知らない人とのやりとりなし、アカウントは保護者が作成・管理します。保存するのはお子さまの名前、年齢層、ゲームの結果だけで、ヨーロッパで保管されます。アカウントは保護者ページからいつでも削除できます。',
    account: { deleteTitle: 'アカウントを削除', deleteText: 'アカウント、お子さまのプロフィール、すべての結果を完全に削除します。元に戻せません。', deleteButton: '完全に削除する', deleteConfirm: '確認のため「削除」と入力してください', deleteWord: '削除', deleting: '削除中…', deleteError: '削除できませんでした。もう一度お試しいただくか、お問い合わせください。' },
  },
  ko: {
    trust: { eu_storage: '데이터는 유럽에 보관', encrypted: '암호화된 연결', no_ads: '광고 없음', parent_account: '보호자가 관리하는 계정' },
    safe_space: '안전한 공간', safe_space_desc: '광고 없음, 데이터는 유럽에 보관, 계정은 보호자가 관리해요. 아이의 이름만 저장해요.',
    a1: '지기는 아이들을 위해 만들어졌어요. 광고도, 모르는 사람과의 대화도 없고, 계정은 보호자가 만들고 관리합니다. 아이의 이름, 연령대, 게임 결과만 유럽에 보관해요. 계정은 보호자 페이지에서 언제든 삭제할 수 있어요.',
    account: { deleteTitle: '계정 삭제', deleteText: '계정, 아이의 프로필, 모든 결과를 영구적으로 삭제해요. 되돌릴 수 없어요.', deleteButton: '영구 삭제', deleteConfirm: '확인하려면 삭제 라고 입력하세요', deleteWord: '삭제', deleting: '삭제 중…', deleteError: '삭제하지 못했어요. 다시 시도하거나 문의해 주세요.' },
  },
  zh: {
    trust: { eu_storage: '数据存储在欧洲', encrypted: '加密连接', no_ads: '零广告', parent_account: '由家长管理的账户' },
    safe_space: '安全的空间', safe_space_desc: '无广告，数据存储在欧洲，账户由家长管理。我们只保存孩子的名字。',
    a1: 'Ziggy 专为孩子设计：没有广告，不与陌生人交流，账户由家长创建和管理。我们只保存孩子的名字、年龄段和游戏成绩，存储在欧洲。家长可以随时在家长专区删除账户。',
    account: { deleteTitle: '删除账户', deleteText: '永久删除账户、孩子的档案和全部成绩。此操作无法撤销。', deleteButton: '永久删除', deleteConfirm: '输入“删除”以确认', deleteWord: '删除', deleting: '正在删除…', deleteError: '删除失败，请重试或联系我们。' },
  },
  ar: {
    trust: { eu_storage: 'بيانات محفوظة في أوروبا', encrypted: 'اتصال مشفّر', no_ads: 'بلا إعلانات', parent_account: 'حساب يديره وليّ الأمر' },
    safe_space: 'مساحة آمنة', safe_space_desc: 'بلا إعلانات، وبيانات محفوظة في أوروبا، وحساب يديره وليّ الأمر. لا نحتفظ إلا بالاسم الأول للطفل.',
    a1: 'صُمّم زيجي للأطفال: بلا إعلانات ولا تواصل مع الغرباء، ويُنشئ الحساب ويديره وليّ الأمر. لا نحتفظ إلا بالاسم الأول للطفل وفئته العمرية ونتائج ألعابه، وكلها محفوظة في أوروبا. يمكن حذف الحساب في أي وقت من مساحة وليّ الأمر.',
    account: { deleteTitle: 'حذف الحساب', deleteText: 'يحذف الحساب وملف الطفل وجميع نتائجه نهائيًا. لا يمكن التراجع عن ذلك.', deleteButton: 'حذف نهائي', deleteConfirm: 'اكتب حذف للتأكيد', deleteWord: 'حذف', deleting: 'جارٍ الحذف…', deleteError: 'تعذّر الحذف. حاول مجددًا أو تواصل معنا.' },
  },
};

let n = 0;
for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const locale = file.replace('.json', '');
  const path = join(dir, file);
  const data = JSON.parse(readFileSync(path, 'utf8'));
  const src = L[locale] ?? L.en;
  data.trust = src.trust;
  data.features = { ...data.features, safe_space: src.safe_space, safe_space_desc: src.safe_space_desc };
  data.faq = { ...data.faq, a1: src.a1 };
  data.account = { ...data.account, ...src.account };
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
  n++;
}
console.log(`claims corrected in ${n} locales`);
