/**
 * Limites do agendamento pelo site (P0 7 da revisão de 20/10/2026). O
 * throttle por IP (10/min no controller) sozinho deixava um único IP marcar
 * ~600 horários por hora, todos já confirmados e cada um abrindo negócio no
 * kanban; trocando de IP, sem teto nenhum. Estes limites são de NEGÓCIO e
 * valem no caso de uso, qualquer que seja a origem da requisição.
 *
 * Constantes (não configuração da conta) de propósito: são proteção, não
 * preferência; se algum cliente precisar de mais, vira campo do
 * `booking_settings` ou limite do plano.
 */

/**
 * Agendamentos FUTUROS ATIVOS (`scheduled`, começando depois de agora)
 * marcados PELO SITE para o mesmo contato. O contato é o que a captura acha
 * pelo telefone normalizado (E.164) ou pelo e-mail — a mesma regra que
 * impede contato duplicado. Os marcados pela equipe no painel não contam:
 * quem decide esses é a empresa.
 */
export const MAX_ACTIVE_ONLINE_BOOKINGS_PER_CONTACT = 2;

/**
 * Agendamentos criados pelo site por conta no mesmo dia (no fuso da conta),
 * contando os que já foram cancelados depois — o teto é de marcações, não
 * de horários ocupados, senão marcar-e-cancelar o contornaria.
 */
export const MAX_ONLINE_BOOKINGS_PER_DAY = 50;
