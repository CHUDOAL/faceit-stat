// Конфигурация
let config = {
    faceitNickname: localStorage.getItem('faceitNickname') || '',
    updateInterval: parseInt(localStorage.getItem('updateInterval')) || 30,
    playerId: null,
    twitchChannel: 'chudo_a' // Twitch канал для отслеживания
};

// Faceit API endpoints
const FACEIT_API_BASE = 'https://open.faceit.com/data/v4';
const FACEIT_API_KEY = '1aadf8ae-e0fb-4800-a76a-636448a890c1'; // Замените на ваш API ключ или используйте публичный доступ

// Twitch API
const TWITCH_CLIENT_ID = 'YOUR_TWITCH_CLIENT_ID'; // Можно оставить пустым для публичного API
const TWITCH_API_BASE = 'https://api.twitch.tv/helix';

// Глобальные переменные
let updateIntervalId = null;
let twitchCheckIntervalId = null;
let streamSession = null; // Текущая сессия стрима
let initialStats = null; // Начальная статистика при начале стрима

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    loadConfig();
    loadStreamSession();
    
    // Начинаем отслеживание Twitch стрима
    checkTwitchStream();
    setInterval(checkTwitchStream, 60000); // Проверяем каждую минуту
    
    if (config.faceitNickname) {
        fetchPlayerData();
        startAutoUpdate();
    } else {
        showConfig();
    }
});

// Запуск автоматического обновления
function startAutoUpdate() {
    if (updateIntervalId) {
        clearInterval(updateIntervalId);
    }
    updateIntervalId = setInterval(fetchPlayerData, config.updateInterval * 1000);
}

// Загрузка конфигурации
function loadConfig() {
    const savedNickname = localStorage.getItem('faceitNickname');
    const savedInterval = localStorage.getItem('updateInterval');
    
    if (savedNickname) {
        config.faceitNickname = savedNickname;
        document.getElementById('faceitNickname').value = savedNickname;
    }
    
    if (savedInterval) {
        config.updateInterval = parseInt(savedInterval);
        document.getElementById('updateInterval').value = savedInterval;
    }
}

// Сохранение конфигурации
function saveConfig() {
    const nickname = document.getElementById('faceitNickname').value.trim();
    const interval = parseInt(document.getElementById('updateInterval').value);
    
    if (!nickname) {
        alert('Пожалуйста, введите Faceit никнейм!');
        return;
    }
    
    if (interval < 10 || interval > 300) {
        alert('Интервал обновления должен быть от 10 до 300 секунд!');
        return;
    }
    
    config.faceitNickname = nickname;
    config.updateInterval = interval;
    
    localStorage.setItem('faceitNickname', nickname);
    localStorage.setItem('updateInterval', interval.toString());
    
    // Обновляем данные сразу
    updateDisplay('---', 'Загрузка...', '---', '', null);
    fetchPlayerData();
    
    // Перезапускаем интервал
    startAutoUpdate();
    
    alert('Настройки сохранены! Загрузка данных...');
    toggleConfig();
}

// Переключение панели настроек
function toggleConfig() {
    const panel = document.getElementById('configPanel');
    panel.classList.toggle('show');
}

// Получение данных игрока с Faceit
async function fetchPlayerData() {
    if (!config.faceitNickname) {
        updateDisplay('---', 'Введите никнейм в настройках', '---', '', null);
        return;
    }
    
    // Сначала пробуем API с ключом (если он есть)
    if (FACEIT_API_KEY && FACEIT_API_KEY !== 'YOUR_API_KEY_HERE') {
        try {
            await fetchPlayerDataWithAPI();
            return;
        } catch (error) {
            console.error('Ошибка API метода, пробуем альтернативный:', error);
            // Если API с ключом не сработал, пробуем альтернативный метод
        }
    }
    
    // Пробуем альтернативный метод (работает без API ключа)
    try {
        await fetchPlayerDataAlternative();
    } catch (error) {
        console.error('Ошибка альтернативного метода:', error);
        updateDisplay('ERROR', 'Проверьте никнейм', '---', '', null);
    }
}

// Метод с использованием API ключа
async function fetchPlayerDataWithAPI() {
    try {
        const nickname = encodeURIComponent(config.faceitNickname);
        const apiUrl = `${FACEIT_API_BASE}/players?nickname=${nickname}`;
        
        console.log('Запрос к Faceit API:', apiUrl);
        console.log('Никнейм:', config.faceitNickname);
        
        // Правильный endpoint для Faceit API v4
        const playerResponse = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${FACEIT_API_KEY}`,
                'Accept': 'application/json'
            }
        });
        
        console.log('Статус ответа:', playerResponse.status, playerResponse.statusText);
        
        if (!playerResponse.ok) {
            let errorText = '';
            try {
                errorText = await playerResponse.text();
                console.error('Текст ошибки:', errorText);
            } catch (e) {
                console.error('Не удалось прочитать текст ошибки');
            }
            
            if (playerResponse.status === 404) {
                throw new Error('Игрок не найден. Проверьте правильность никнейма. Убедитесь, что никнейм точно совпадает с Faceit профилем (регистр важен!).');
            } else if (playerResponse.status === 401 || playerResponse.status === 403) {
                throw new Error('Неверный API ключ или нет доступа. Проверьте API ключ.');
            } else {
                throw new Error(`API ошибка: ${playerResponse.status} - ${errorText || playerResponse.statusText}`);
            }
        }
        
        const playerData = await playerResponse.json();
        console.log('Данные игрока получены:', playerData);
        
        if (!playerData || !playerData.player_id) {
            console.error('Неверный формат ответа:', playerData);
            throw new Error('Неверный формат ответа API. Игрок не найден.');
        }
        
        config.playerId = playerData.player_id;
        console.log('Player ID:', config.playerId);
        
        // Получаем ELO и уровень для CS2 или CS:GO
        let elo = 'N/A';
        let level = 'N/A';
        
        // Проверяем CS2
        if (playerData.games && playerData.games.cs2) {
            elo = playerData.games.cs2.faceit_elo || 'N/A';
            level = playerData.games.cs2.skill_level || 'N/A';
            console.log('CS2 данные:', { elo, level });
        }
        // Если CS2 нет, проверяем CS:GO
        else if (playerData.games && playerData.games.csgo) {
            elo = playerData.games.csgo.faceit_elo || 'N/A';
            level = playerData.games.csgo.skill_level || 'N/A';
            console.log('CS:GO данные:', { elo, level });
        } else {
            console.warn('Нет данных о CS2 или CS:GO играх');
        }
        
        // Получаем аватарку
        const avatar = playerData.avatar || playerData.avatar_url || '';
        
        // Получаем статистику
        let stats = {
            wins: 'N/A',
            losses: 'N/A',
            winRate: 'N/A',
            kd: 'N/A'
        };
        
        // Если ELO не найден в основных данных или нужно получить статистику
        if (config.playerId) {
            try {
                const gameType = playerData.games?.cs2 ? 'cs2' : 'csgo';
                const statsResponse = await fetch(
                    `${FACEIT_API_BASE}/players/${config.playerId}/stats/${gameType}`,
                    {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${FACEIT_API_KEY}`,
                            'Accept': 'application/json'
                        }
                    }
                );
                
                if (statsResponse.ok) {
                    const statsData = await statsResponse.json();
                    console.log('Статистика получена:', statsData);
                    
                    // Если ELO не найден, пробуем получить из статистики
                    if (elo === 'N/A' && statsData.lifetime && statsData.lifetime.Average) {
                        elo = statsData.lifetime.Average;
                    }
                    
                    // Получаем статистику - проверяем разные форматы ответа
                    // Faceit API может возвращать данные в segments или lifetime
                    let lifetime = null;
                    
                    if (statsData.lifetime) {
                        lifetime = statsData.lifetime;
                    } else if (statsData.segments && statsData.segments.length > 0) {
                        // Если данные в segments, берем первый сегмент (обычно это общая статистика)
                        lifetime = statsData.segments[0].stats || statsData.segments[0];
                    }
                    
                    if (lifetime) {
                        console.log('Lifetime данные:', lifetime);
                        console.log('Все ключи lifetime:', Object.keys(lifetime));
                        
                        // Wins - пробуем разные варианты названий и преобразуем в число
                        let winsValue = lifetime['Wins'] || 
                                      lifetime['Matches Won'] || 
                                      lifetime['wins'] ||
                                      lifetime['matches_won'] ||
                                      lifetime['W'] ||
                                      null;
                        
                        // Преобразуем в число
                        if (winsValue !== null && winsValue !== undefined) {
                            stats.wins = typeof winsValue === 'number' ? winsValue : parseInt(winsValue);
                            if (isNaN(stats.wins)) {
                                stats.wins = 'N/A';
                            }
                        } else {
                            stats.wins = 'N/A';
                        }
                        
                        // Losses - пробуем разные варианты названий
                        let lossesValue = lifetime['Losses'] || 
                                         lifetime['Matches Lost'] || 
                                         lifetime['losses'] ||
                                         lifetime['matches_lost'] ||
                                         lifetime['L'] ||
                                         lifetime['Lost'] ||
                                         lifetime['lost'] ||
                                         null;
                        
                        // Преобразуем в число, если найдено
                        if (lossesValue !== null && lossesValue !== undefined) {
                            stats.losses = typeof lossesValue === 'number' ? lossesValue : parseInt(lossesValue);
                            if (isNaN(stats.losses)) {
                                stats.losses = 'N/A';
                            }
                        } else {
                            stats.losses = 'N/A';
                        }
                        
                        // Если Losses не найден, вычисляем из Total Matches и Wins или из Wins и Win Rate
                        if (stats.losses === 'N/A' || stats.losses === null) {
                            // Сначала пробуем из Total Matches
                            const totalMatches = lifetime['Total Matches'] || 
                                                lifetime['total_matches'] || 
                                                lifetime['Matches'] ||
                                                lifetime['matches'] ||
                                                null;
                            
                            // Преобразуем totalMatches в число
                            let totalMatchesNum = null;
                            if (totalMatches !== null && totalMatches !== undefined) {
                                totalMatchesNum = typeof totalMatches === 'number' ? totalMatches : parseInt(totalMatches);
                                if (isNaN(totalMatchesNum)) {
                                    totalMatchesNum = null;
                                }
                            }
                            
                            if (totalMatchesNum && typeof stats.wins === 'number') {
                                stats.losses = Math.max(0, totalMatchesNum - stats.wins);
                                console.log('Losses вычислено из Total Matches:', totalMatchesNum, '- Wins:', stats.wins, '=', stats.losses);
                            } else if (typeof stats.wins === 'number' && lifetime['Win Rate %']) {
                                // Вычисляем из Win Rate и Wins
                                const winRate = parseFloat(lifetime['Win Rate %']);
                                if (!isNaN(winRate) && winRate > 0) {
                                    // Total Matches = Wins / (Win Rate / 100)
                                    const calculatedTotal = Math.round(stats.wins / (winRate / 100));
                                    stats.losses = Math.max(0, calculatedTotal - stats.wins);
                                    console.log('Losses вычислено из Win Rate и Wins:', {
                                        wins: stats.wins,
                                        winRate: winRate + '%',
                                        totalMatches: calculatedTotal,
                                        losses: stats.losses
                                    });
                                }
                            }
                        }
                        
                        // Если есть Total Matches, но нет отдельных Wins/Losses
                        if (stats.wins === 'N/A' && stats.losses === 'N/A' && lifetime['Total Matches']) {
                            // Пробуем вычислить из Win Rate
                            if (lifetime['Win Rate %']) {
                                const totalMatches = lifetime['Total Matches'];
                                const winRate = parseFloat(lifetime['Win Rate %']);
                                if (!isNaN(winRate) && !isNaN(totalMatches)) {
                                    stats.wins = Math.round((winRate / 100) * totalMatches);
                                    stats.losses = totalMatches - stats.wins;
                                    console.log('Wins и Losses вычислены из Win Rate:', stats.wins, stats.losses);
                                }
                            }
                        }
                        
                        // Вычисляем Win Rate
                        if (typeof stats.wins === 'number' && typeof stats.losses === 'number') {
                            const totalMatches = stats.wins + stats.losses;
                            if (totalMatches > 0) {
                                stats.winRate = ((stats.wins / totalMatches) * 100).toFixed(1) + '%';
                            }
                        } else if (lifetime['Win Rate %']) {
                            // Используем Win Rate из API, если доступен
                            stats.winRate = parseFloat(lifetime['Win Rate %']).toFixed(1) + '%';
                            
                            // Если Losses все еще не найден, но есть Wins и Win Rate, вычисляем Losses
                            if ((stats.losses === 'N/A' || stats.losses === null) && typeof stats.wins === 'number') {
                                const winRate = parseFloat(lifetime['Win Rate %']);
                                if (!isNaN(winRate) && winRate > 0 && winRate < 100) {
                                    // Total Matches = Wins / (Win Rate / 100)
                                    const calculatedTotal = Math.round(stats.wins / (winRate / 100));
                                    stats.losses = Math.max(0, calculatedTotal - stats.wins);
                                    console.log('Losses вычислено из Win Rate и Wins (после получения Win Rate):', {
                                        wins: stats.wins,
                                        winRate: winRate + '%',
                                        totalMatches: calculatedTotal,
                                        losses: stats.losses
                                    });
                                }
                            }
                        }
                        
                        // K/D Ratio
                        stats.kd = lifetime['Average K/D Ratio'] || 
                                  lifetime['K/D Ratio'] || 
                                  lifetime['KD'] ||
                                  lifetime['kd'] ||
                                  (lifetime['Average Kills'] && lifetime['Average Deaths'] 
                                   ? (lifetime['Average Kills'] / lifetime['Average Deaths']).toFixed(2)
                                   : 'N/A');
                    }
                    
                    console.log('Обработанная статистика:', stats);
                }
            } catch (statsError) {
                console.log('Не удалось получить статистику:', statsError);
            }
        }
        
        // Получаем статистику последнего матча
        let lastMatchStats = null;
        if (config.playerId) {
            try {
                lastMatchStats = await fetchLastMatchStats(config.playerId, playerData.games?.cs2 ? 'cs2' : 'csgo');
            } catch (error) {
                console.error('Ошибка получения последнего матча:', error);
                lastMatchStats = null;
            }
        }
        
        updateDisplay(elo, config.faceitNickname, getRankName(level), avatar, lastMatchStats);
        
    } catch (error) {
        console.error('Ошибка API метода:', error);
        console.error('Детали ошибки:', {
            nickname: config.faceitNickname,
            apiKey: FACEIT_API_KEY ? 'Установлен' : 'Не установлен',
            error: error.message
        });
        
        // Показываем более понятное сообщение об ошибке
        if (error.message.includes('не найден')) {
            updateDisplay('ERROR', 'Игрок не найден', 'Проверьте никнейм', '', null, null);
        } else if (error.message.includes('API ключ')) {
            updateDisplay('ERROR', 'Ошибка API ключа', 'Проверьте ключ', '', null, null);
        } else {
            updateDisplay('ERROR', error.message.substring(0, 30) + '...', '---', '', null, null);
        }
        
        throw error;
    }
}

// Альтернативный метод получения данных (без API ключа, через публичный доступ)
async function fetchPlayerDataAlternative() {
    try {
        // Метод 1: Прямой запрос к публичному API Faceit
        const nickname = encodeURIComponent(config.faceitNickname);
        
        // Получаем информацию об игроке через публичный API
        const playerResponse = await fetch(
            `https://api.faceit.com/users/v1/nicknames/${nickname}`,
            {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            }
        );
        
        if (!playerResponse.ok) {
            // Метод 2: Пробуем через веб-скрапинг данных (через CORS прокси или напрямую)
            await fetchPlayerDataWebScraping();
            return;
        }
        
        const playerData = await playerResponse.json();
        const playerId = playerData.payload?.guid || playerData.payload?.player_id;
        
        if (!playerId) {
            throw new Error('Игрок не найден');
        }
        
        config.playerId = playerId;
        
        // Получаем детальную информацию об игроке
        const detailResponse = await fetch(
            `https://api.faceit.com/core/v1/users/${playerId}`,
            {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            }
        );
        
        let elo = 'N/A';
        let level = 'N/A';
        let avatar = '';
        let stats = {
            wins: 'N/A',
            losses: 'N/A',
            winRate: 'N/A',
            kd: 'N/A'
        };
        
        if (detailResponse.ok) {
            const detailData = await detailResponse.json();
            // Получаем аватарку
            avatar = detailData.payload?.avatar || detailData.payload?.avatar_url || 
                    detailData.avatar || detailData.avatar_url || '';
            
            // Пробуем получить ELO для CS2 или CS:GO
            elo = detailData.payload?.games?.cs2?.faceit_elo || 
                  detailData.payload?.games?.csgo?.faceit_elo || 
                  detailData.games?.cs2?.faceit_elo || 
                  detailData.games?.csgo?.faceit_elo || 
                  'N/A';
            
            level = detailData.payload?.games?.cs2?.skill_level || 
                    detailData.payload?.games?.csgo?.skill_level || 
                    detailData.games?.cs2?.skill_level || 
                    detailData.games?.csgo?.skill_level || 
                    'N/A';
        }
        
        // Если ELO не найден, пробуем получить через статистику
        if (elo === 'N/A' || elo === null) {
            const statsResponse = await fetch(
                `https://api.faceit.com/stats/v1/stats/users/${playerId}/games/cs2`,
                {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    }
                }
            );
            
            if (statsResponse.ok) {
                const statsData = await statsResponse.json();
                console.log('Статистика (альтернативный метод):', statsData);
                
                elo = statsData.lifetime?.Average || statsData.lifetime?.Elo || elo;
                
                // Получаем статистику - проверяем разные форматы ответа
                // Faceit API может возвращать данные в segments или lifetime
                let lifetime = null;
                
                if (statsData.lifetime) {
                    lifetime = statsData.lifetime;
                } else if (statsData.segments && statsData.segments.length > 0) {
                    // Если данные в segments, берем первый сегмент (обычно это общая статистика)
                    lifetime = statsData.segments[0].stats || statsData.segments[0];
                }
                
                if (lifetime) {
                    console.log('Lifetime данные (альтернативный):', lifetime);
                    console.log('Все ключи lifetime (альтернативный):', Object.keys(lifetime));
                    
                    // Wins - пробуем разные варианты названий и преобразуем в число
                    let winsValue = lifetime['Wins'] || 
                                  lifetime['Matches Won'] || 
                                  lifetime['wins'] ||
                                  lifetime['matches_won'] ||
                                  lifetime['W'] ||
                                  null;
                    
                    // Преобразуем в число
                    if (winsValue !== null && winsValue !== undefined) {
                        stats.wins = typeof winsValue === 'number' ? winsValue : parseInt(winsValue);
                        if (isNaN(stats.wins)) {
                            stats.wins = 'N/A';
                        }
                    } else {
                        stats.wins = 'N/A';
                    }
                    
                    // Losses - пробуем разные варианты названий
                    let lossesValue = lifetime['Losses'] || 
                                     lifetime['Matches Lost'] || 
                                     lifetime['losses'] ||
                                     lifetime['matches_lost'] ||
                                     lifetime['L'] ||
                                     lifetime['Lost'] ||
                                     lifetime['lost'] ||
                                     null;
                    
                    // Преобразуем в число, если найдено
                    if (lossesValue !== null && lossesValue !== undefined) {
                        stats.losses = typeof lossesValue === 'number' ? lossesValue : parseInt(lossesValue);
                        if (isNaN(stats.losses)) {
                            stats.losses = 'N/A';
                        }
                    } else {
                        stats.losses = 'N/A';
                    }
                    
                    // Если Losses не найден, вычисляем из Total Matches и Wins или из Wins и Win Rate
                    if (stats.losses === 'N/A' || stats.losses === null) {
                        // Сначала пробуем из Total Matches
                        const totalMatches = lifetime['Total Matches'] || 
                                            lifetime['total_matches'] || 
                                            lifetime['Matches'] ||
                                            lifetime['matches'] ||
                                            null;
                        
                        // Преобразуем totalMatches в число
                        let totalMatchesNum = null;
                        if (totalMatches !== null && totalMatches !== undefined) {
                            totalMatchesNum = typeof totalMatches === 'number' ? totalMatches : parseInt(totalMatches);
                            if (isNaN(totalMatchesNum)) {
                                totalMatchesNum = null;
                            }
                        }
                        
                        if (totalMatchesNum && typeof stats.wins === 'number') {
                            stats.losses = Math.max(0, totalMatchesNum - stats.wins);
                            console.log('Losses вычислено из Total Matches (альтернативный):', totalMatchesNum, '- Wins:', stats.wins, '=', stats.losses);
                        } else if (typeof stats.wins === 'number' && lifetime['Win Rate %']) {
                            // Вычисляем из Win Rate и Wins
                            const winRate = parseFloat(lifetime['Win Rate %']);
                            if (!isNaN(winRate) && winRate > 0) {
                                // Total Matches = Wins / (Win Rate / 100)
                                const calculatedTotal = Math.round(stats.wins / (winRate / 100));
                                stats.losses = Math.max(0, calculatedTotal - stats.wins);
                                console.log('Losses вычислено из Win Rate и Wins (альтернативный):', {
                                    wins: stats.wins,
                                    winRate: winRate + '%',
                                    totalMatches: calculatedTotal,
                                    losses: stats.losses
                                });
                            }
                        }
                    }
                    
                    // Если есть Total Matches, но нет отдельных Wins/Losses
                    if (stats.wins === 'N/A' && stats.losses === 'N/A' && lifetime['Total Matches']) {
                        // Пробуем вычислить из Win Rate
                        if (lifetime['Win Rate %']) {
                            const totalMatches = lifetime['Total Matches'];
                            const winRate = parseFloat(lifetime['Win Rate %']);
                            if (!isNaN(winRate) && !isNaN(totalMatches)) {
                                stats.wins = Math.round((winRate / 100) * totalMatches);
                                stats.losses = totalMatches - stats.wins;
                                console.log('Wins и Losses вычислены из Win Rate (альтернативный):', stats.wins, stats.losses);
                            }
                        }
                    }
                    
                    // Вычисляем Win Rate
                    if (typeof stats.wins === 'number' && typeof stats.losses === 'number') {
                        const totalMatches = stats.wins + stats.losses;
                        if (totalMatches > 0) {
                            stats.winRate = ((stats.wins / totalMatches) * 100).toFixed(1) + '%';
                        }
                    } else if (lifetime['Win Rate %']) {
                        // Используем Win Rate из API, если доступен
                        stats.winRate = parseFloat(lifetime['Win Rate %']).toFixed(1) + '%';
                        
                        // Если Losses все еще не найден, но есть Wins и Win Rate, вычисляем Losses
                        if ((stats.losses === 'N/A' || stats.losses === null) && typeof stats.wins === 'number') {
                            const winRate = parseFloat(lifetime['Win Rate %']);
                            if (!isNaN(winRate) && winRate > 0 && winRate < 100) {
                                // totalMatches = wins / (winRate / 100)
                                const calculatedTotal = Math.round((stats.wins / winRate) * 100);
                                stats.losses = calculatedTotal - stats.wins;
                                console.log('Losses вычислено из Win Rate и Wins (альтернативный, после получения Win Rate):', stats.losses);
                            }
                        }
                    }
                    
                    // K/D Ratio
                    stats.kd = lifetime['Average K/D Ratio'] || 
                              lifetime['K/D Ratio'] || 
                              lifetime['KD'] ||
                              lifetime['kd'] ||
                              (lifetime['Average Kills'] && lifetime['Average Deaths'] 
                               ? (lifetime['Average Kills'] / lifetime['Average Deaths']).toFixed(2)
                               : 'N/A');
                }
                
                console.log('Обработанная статистика (альтернативный):', stats);
            }
        }
        
        // Получаем статистику последнего матча
        let lastMatchStats = null;
        if (config.playerId) {
            try {
                lastMatchStats = await fetchLastMatchStats(config.playerId, playerData.games?.cs2 ? 'cs2' : 'csgo');
            } catch (error) {
                console.error('Ошибка получения последнего матча:', error);
                lastMatchStats = null;
            }
        }
        
        updateDisplay(elo, config.faceitNickname, getRankName(level), avatar, lastMatchStats);
        
    } catch (error) {
        console.error('Ошибка альтернативного метода:', error);
        // Пробуем веб-скрапинг как последний вариант
        await fetchPlayerDataWebScraping();
    }
}

// Метод через веб-скрапинг (резервный)
async function fetchPlayerDataWebScraping() {
    try {
        // Используем публичный профиль Faceit
        const profileUrl = `https://www.faceit.com/ru/players/${encodeURIComponent(config.faceitNickname)}`;
        
        // Пробуем получить данные через CORS прокси (если доступен)
        // Или используем альтернативный метод
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(profileUrl)}`;
        
        const response = await fetch(proxyUrl);
        
        if (response.ok) {
            const data = await response.json();
            const html = data.contents;
            
            // Парсим HTML для поиска ELO (базовый парсинг)
            const eloMatch = html.match(/elo["\s:]+(\d+)/i) || 
                           html.match(/rating["\s:]+(\d+)/i) ||
                           html.match(/faceit_elo["\s:]+(\d+)/i);
            
            const levelMatch = html.match(/level["\s:]+(\d+)/i) ||
                             html.match(/skill_level["\s:]+(\d+)/i);
            
            const elo = eloMatch ? parseInt(eloMatch[1]) : 'N/A';
            const level = levelMatch ? parseInt(levelMatch[1]) : 'N/A';
            
            if (elo !== 'N/A') {
                updateDisplay(elo, config.faceitNickname, getRankName(level), '', null);
                return;
            }
        }
        
        throw new Error('Не удалось получить данные через веб-скрапинг');
        
    } catch (error) {
        console.error('Ошибка веб-скрапинга:', error);
        updateDisplay('ERROR', 'Проверьте никнейм', '---', '', null);
    }
}

// Получение статистики последнего матча
async function fetchLastMatchStats(playerId, gameType = 'cs2') {
    try {
        // Получаем историю матчей
        const historyUrl = `${FACEIT_API_BASE}/players/${playerId}/history?game=${gameType}&offset=0&limit=1`;
        
        console.log('Запрос истории матчей:', historyUrl);
        
        const historyResponse = await fetch(historyUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${FACEIT_API_KEY}`,
                'Accept': 'application/json'
            }
        });
        
        if (!historyResponse.ok) {
            console.error('Ошибка получения истории матчей:', historyResponse.status, historyResponse.statusText);
            // Не бросаем ошибку, просто возвращаем null
            return null;
        }
        
        const historyData = await historyResponse.json();
        
        if (!historyData.items || historyData.items.length === 0) {
            console.log('Нет матчей в истории');
            return null;
        }
        
        const lastMatch = historyData.items[0];
        const matchId = lastMatch.match_id;
        
        console.log('Последний матч (полный объект):', JSON.stringify(lastMatch, null, 2));
        console.log('Все ключи последнего матча:', Object.keys(lastMatch));
        
        // Ищем изменение ELO во всех возможных местах
        const eloFields = {
            'elo': lastMatch.elo,
            'elo_change': lastMatch.elo_change,
            'elo_delta': lastMatch.elo_delta,
            'elo change': lastMatch['elo change'],
            'elo-change': lastMatch['elo-change'],
            'eloChange': lastMatch.eloChange,
            'eloDelta': lastMatch.eloDelta,
            'faceit_elo': lastMatch.faceit_elo,
            'faceit_elo_change': lastMatch.faceit_elo_change
        };
        console.log('ELO поля в последнем матче:', eloFields);
        
        // Проверяем teams для изменения ELO
        if (lastMatch.teams) {
            console.log('Teams в последнем матче:', lastMatch.teams);
            for (const team of lastMatch.teams) {
                if (team.players) {
                    console.log('Players в team:', team.players);
                }
            }
        }
        
        // Получаем детали матча
        const matchUrl = `${FACEIT_API_BASE}/matches/${matchId}`;
        const matchResponse = await fetch(matchUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${FACEIT_API_KEY}`,
                'Accept': 'application/json'
            }
        });
        
        if (!matchResponse.ok) {
            console.error('Ошибка получения матча:', matchResponse.status);
            // Пробуем получить данные только из истории матча
            return getMatchStatsFromHistory(lastMatch, playerId);
        }
        
        const matchData = await matchResponse.json();
        
        // Получаем статистику матча
        const statsUrl = `${FACEIT_API_BASE}/matches/${matchId}/stats`;
        const statsResponse = await fetch(statsUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${FACEIT_API_KEY}`,
                'Accept': 'application/json'
            }
        });
        
        let playerStats = null;
        if (statsResponse.ok) {
            const statsData = await statsResponse.json();
            console.log('Статистика матча:', statsData);
            
            // Ищем статистику игрока в разных форматах ответа API
            // Формат 1: rounds -> teams -> players
            if (statsData.rounds && statsData.rounds.length > 0) {
                for (const round of statsData.rounds) {
                    if (round.teams && round.teams.length > 0) {
                        for (const team of round.teams) {
                            if (team.players && team.players.length > 0) {
                                const player = team.players.find(p => p.player_id === playerId || p.id === playerId);
                                if (player) {
                                    playerStats = player;
                                    break;
                                }
                            }
                        }
                        if (playerStats) break;
                    }
                }
            }
            
            // Формат 2: teams -> players (прямо в корне)
            if (!playerStats && statsData.teams && statsData.teams.length > 0) {
                for (const team of statsData.teams) {
                    if (team.players && team.players.length > 0) {
                        const player = team.players.find(p => p.player_id === playerId || p.id === playerId);
                        if (player) {
                            playerStats = player;
                            break;
                        }
                    }
                }
            }
        }
        
        // Формируем данные о последнем матче
        const matchStats = {
            kills: 'N/A',
            deaths: 'N/A',
            kd: 'N/A',
            eloChange: 'N/A',
            map: 'N/A'
        };
        
        // Получаем kills и deaths из статистики
        if (playerStats) {
            // Пробуем разные варианты названий полей
            matchStats.kills = playerStats.player_stats?.Kills || 
                              playerStats.player_stats?.kills || 
                              playerStats.stats?.Kills ||
                              playerStats.stats?.kills ||
                              playerStats.Kills ||
                              playerStats.kills ||
                              'N/A';
            
            matchStats.deaths = playerStats.player_stats?.Deaths || 
                               playerStats.player_stats?.deaths || 
                               playerStats.stats?.Deaths ||
                               playerStats.stats?.deaths ||
                               playerStats.Deaths ||
                               playerStats.deaths ||
                               'N/A';
            
            // Преобразуем в числа
            if (matchStats.kills !== 'N/A') {
                matchStats.kills = typeof matchStats.kills === 'number' ? matchStats.kills : parseInt(matchStats.kills);
                if (isNaN(matchStats.kills)) matchStats.kills = 'N/A';
            }
            
            if (matchStats.deaths !== 'N/A') {
                matchStats.deaths = typeof matchStats.deaths === 'number' ? matchStats.deaths : parseInt(matchStats.deaths);
                if (isNaN(matchStats.deaths)) matchStats.deaths = 'N/A';
            }
            
            // Вычисляем K/D
            if (typeof matchStats.kills === 'number' && typeof matchStats.deaths === 'number' && matchStats.deaths > 0) {
                matchStats.kd = (matchStats.kills / matchStats.deaths).toFixed(2);
            } else if (playerStats.player_stats?.['K/D Ratio'] || playerStats.stats?.['K/D Ratio']) {
                const kdValue = playerStats.player_stats?.['K/D Ratio'] || playerStats.stats?.['K/D Ratio'];
                matchStats.kd = parseFloat(kdValue).toFixed(2);
            } else if (playerStats['K/D Ratio'] || playerStats.kd) {
                const kdValue = playerStats['K/D Ratio'] || playerStats.kd;
                matchStats.kd = parseFloat(kdValue).toFixed(2);
            }
        }
        
        // Получаем изменение ELO из истории матча
        // ELO изменение может быть в разных полях и форматах
        let eloChange = null;
        
        // Пробуем разные варианты полей (проверяем все возможные варианты)
        const possibleEloFields = [
            'elo', 'elo_change', 'elo_delta', 'elo change', 'elo-change',
            'eloChange', 'eloDelta', 'faceit_elo_change', 'faceit_elo_delta',
            'rating_change', 'rating_delta', 'change', 'delta'
        ];
        
        for (const field of possibleEloFields) {
            const value = lastMatch[field];
            if (value !== undefined && value !== null && value !== '') {
                const numValue = typeof value === 'number' ? value : parseInt(value);
                if (!isNaN(numValue)) {
                    eloChange = numValue;
                    console.log(`Изменение ELO найдено в поле "${field}":`, eloChange);
                    break;
                }
            }
        }
        
        // Если не нашли, пробуем из результата матча или из teams
        if (eloChange === null || isNaN(eloChange)) {
            // В Faceit API изменение ELO может быть в teams
            if (lastMatch.teams && lastMatch.teams.length > 0) {
                for (const team of lastMatch.teams) {
                    if (team.players && team.players.length > 0) {
                        const player = team.players.find(p => 
                            p.player_id === playerId || 
                            p.id === playerId ||
                            p.player_id === lastMatch.game_player_id ||
                            p.id === lastMatch.game_player_id
                        );
                        if (player) {
                            // Пробуем разные поля для изменения ELO
                            if (player.elo !== undefined && player.elo !== null) {
                                eloChange = typeof player.elo === 'number' ? player.elo : parseInt(player.elo);
                            } else if (player.elo_change !== undefined && player.elo_change !== null) {
                                eloChange = typeof player.elo_change === 'number' ? player.elo_change : parseInt(player.elo_change);
                            } else if (player.elo_delta !== undefined && player.elo_delta !== null) {
                                eloChange = typeof player.elo_delta === 'number' ? player.elo_delta : parseInt(player.elo_delta);
                            }
                            if (eloChange !== null && !isNaN(eloChange)) break;
                        }
                    }
                }
            }
            
            // Если все еще не нашли, пробуем вычислить из текущего и предыдущего ELO
            if ((eloChange === null || isNaN(eloChange)) && lastMatch.faceit_elo !== undefined) {
                // Если есть текущий ELO в матче, можно вычислить изменение
                // Но для этого нужен предыдущий ELO, который обычно не в истории
            }
        }
        
        // Форматируем изменение ELO
        if (eloChange !== null && !isNaN(eloChange)) {
            if (eloChange > 0) {
                matchStats.eloChange = `+${eloChange}`;
            } else if (eloChange < 0) {
                matchStats.eloChange = eloChange.toString(); // Уже будет с минусом
            } else {
                matchStats.eloChange = '0';
            }
            console.log('Изменение ELO найдено:', eloChange, '→', matchStats.eloChange);
        } else {
            console.log('Изменение ELO не найдено в последнем матче');
        }
        
        // Получаем карту из разных источников
        // Пробуем разные варианты получения карты
        if (matchData.voting && matchData.voting.map) {
            matchStats.map = matchData.voting.map.name || matchData.voting.map.pick?.[0] || 'N/A';
        } else if (matchData.matchmaking && matchData.matchmaking.map) {
            matchStats.map = matchData.matchmaking.map;
        } else if (matchData.game_map) {
            matchStats.map = matchData.game_map;
        } else if (matchData.map) {
            matchStats.map = matchData.map;
        } else if (lastMatch.match_round_stats && lastMatch.match_round_stats.length > 0) {
            matchStats.map = lastMatch.match_round_stats[0].Map || 'N/A';
        } else if (lastMatch.map) {
            matchStats.map = lastMatch.map;
        }
        
        // Если карта не найдена, пробуем из названия матча или entity
        if (matchStats.map === 'N/A' || !matchStats.map) {
            if (matchData.entity && matchData.entity.name) {
                const mapMatch = matchData.entity.name.match(/(de_\w+)/i);
                if (mapMatch) {
                    matchStats.map = mapMatch[1].replace('de_', '').toUpperCase();
                } else {
                    // Пробуем из полного названия
                    const nameMatch = matchData.entity.name.match(/de_(\w+)/i);
                    if (nameMatch) {
                        matchStats.map = nameMatch[1].toUpperCase();
                    }
                }
            }
        }
        
        // Очищаем название карты от префикса de_
        if (matchStats.map && matchStats.map !== 'N/A') {
            matchStats.map = matchStats.map.toString().replace(/^de_/i, '').toUpperCase();
        }
        
        console.log('Статистика последнего матча:', matchStats);
        return matchStats;
        
    } catch (error) {
        console.error('Ошибка получения последнего матча:', error);
        // Возвращаем null вместо того, чтобы бросать ошибку
        return null;
    }
}

// Получение статистики матча только из истории (fallback)
function getMatchStatsFromHistory(lastMatch, playerId) {
    const matchStats = {
        kills: 'N/A',
        deaths: 'N/A',
        kd: 'N/A',
        eloChange: 'N/A',
        map: 'N/A'
    };
    
    // Получаем изменение ELO из истории
    const possibleEloFields = [
        'elo', 'elo_change', 'elo_delta', 'elo change', 'elo-change',
        'eloChange', 'eloDelta', 'faceit_elo_change', 'faceit_elo_delta',
        'rating_change', 'rating_delta', 'change', 'delta'
    ];
    
    for (const field of possibleEloFields) {
        const value = lastMatch[field];
        if (value !== undefined && value !== null && value !== '') {
            const numValue = typeof value === 'number' ? value : parseInt(value);
            if (!isNaN(numValue)) {
                if (numValue > 0) {
                    matchStats.eloChange = `+${numValue}`;
                } else if (numValue < 0) {
                    matchStats.eloChange = numValue.toString();
                } else {
                    matchStats.eloChange = '0';
                }
                break;
            }
        }
    }
    
    // Получаем карту из истории
    if (lastMatch.match_round_stats && lastMatch.match_round_stats.length > 0) {
        matchStats.map = lastMatch.match_round_stats[0].Map || 'N/A';
    } else if (lastMatch.map) {
        matchStats.map = lastMatch.map;
    }
    
    // Очищаем название карты от префикса de_
    if (matchStats.map && matchStats.map !== 'N/A') {
        matchStats.map = matchStats.map.toString().replace(/^de_/i, '').toUpperCase();
    }
    
    return matchStats;
}

// Обновление отображения
function updateDisplay(elo, playerName, rank, avatar = '', matchStats = null) {
    const eloValueElement = document.getElementById('eloValue'); // Основной ELO в главном блоке
    const nameElement = document.getElementById('playerName');
    const rankElement = document.getElementById('rankBadge').querySelector('.rank-text');
    const avatarElement = document.getElementById('playerAvatar');
    const avatarPlaceholder = document.getElementById('avatarPlaceholder');
    
    // Анимация обновления ELO
    eloValueElement.style.transform = 'scale(0.9)';
    setTimeout(() => {
        eloValueElement.textContent = elo === 'N/A' || elo === 'ERROR' ? elo : formatElo(elo);
        eloValueElement.style.transform = 'scale(1)';
    }, 150);
    
    nameElement.textContent = playerName;
    rankElement.textContent = rank;
    
    // Обновление аватарки
    if (avatar && avatar.trim() !== '') {
        avatarElement.src = avatar;
        avatarElement.style.display = 'block';
        avatarPlaceholder.style.display = 'none';
    } else {
        avatarElement.style.display = 'none';
        avatarPlaceholder.style.display = 'flex';
    }
    
    // Обновление статистики последнего матча
    if (matchStats) {
        console.log('Обновление статистики последнего матча в UI:', matchStats);
        
        const killsElement = document.getElementById('statKills');
        const deathsElement = document.getElementById('statDeaths');
        const kdElement = document.getElementById('statKD');
        const eloChangeElement = document.getElementById('statELO'); // Изменение ELO в статистике
        const mapElement = document.getElementById('mapValue');
        
        if (killsElement) {
            killsElement.textContent = formatStat(matchStats.kills);
        }
        if (deathsElement) {
            deathsElement.textContent = formatStat(matchStats.deaths);
        }
        if (kdElement) {
            kdElement.textContent = formatStat(matchStats.kd);
        }
        if (eloChangeElement) {
            // Форматируем изменение ELO
            let eloChangeText = '---';
            if (matchStats.eloChange && matchStats.eloChange !== 'N/A' && matchStats.eloChange !== null) {
                eloChangeText = matchStats.eloChange.toString();
                // Убеждаемся, что отрицательные значения отображаются с минусом
                if (typeof matchStats.eloChange === 'number' && matchStats.eloChange < 0) {
                    eloChangeText = matchStats.eloChange.toString();
                } else if (typeof matchStats.eloChange === 'number' && matchStats.eloChange > 0) {
                    eloChangeText = `+${matchStats.eloChange}`;
                } else if (typeof matchStats.eloChange === 'number' && matchStats.eloChange === 0) {
                    eloChangeText = '0';
                }
            }
            
            eloChangeElement.textContent = eloChangeText;
            console.log('ELO изменение отображается:', eloChangeText);
            
            // Цвет для ELO изменения
            if (eloChangeText !== '---' && eloChangeText !== 'N/A') {
                if (eloChangeText.startsWith('+')) {
                    eloChangeElement.style.color = '#4ade80'; // Зеленый для плюса
                } else if (eloChangeText.startsWith('-')) {
                    eloChangeElement.style.color = '#f87171'; // Красный для минуса
                } else if (eloChangeText === '0') {
                    eloChangeElement.style.color = '#ffffff'; // Белый для нуля
                } else {
                    eloChangeElement.style.color = '#ffffff'; // Белый по умолчанию
                }
            } else {
                eloChangeElement.style.color = '#ffffff'; // Белый если нет данных
            }
        }
        if (mapElement) {
            mapElement.textContent = formatStat(matchStats.map);
        }
    } else {
        console.log('Статистика последнего матча не передана в updateDisplay');
        // Показываем "---" если нет данных
        const elements = ['statKills', 'statDeaths', 'statKD', 'statELO', 'mapValue'];
        elements.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '---';
        });
    }
    
    // Изменение цвета в зависимости от ELO (в стиле WINLINE - белый/оранжевый)
    if (typeof elo === 'number') {
        // Удаляем предыдущие атрибуты
        eloValueElement.removeAttribute('data-elo-range');
        
        if (elo >= 2000) {
            eloValueElement.style.color = '#ff6b35'; // Оранжевый для высокого ELO
            eloValueElement.setAttribute('data-elo-range', 'high');
        } else if (elo >= 1500) {
            eloValueElement.style.color = '#ff8c5a'; // Светло-оранжевый
            eloValueElement.setAttribute('data-elo-range', 'medium');
        } else if (elo >= 1000) {
            eloValueElement.style.color = '#ffffff'; // Белый
            eloValueElement.setAttribute('data-elo-range', 'low');
        } else {
            eloValueElement.style.color = '#ffffff'; // Белый
            eloValueElement.setAttribute('data-elo-range', 'low');
        }
    } else if (elo === 'ERROR') {
        eloValueElement.style.color = '#ff6b35'; // Оранжевый для ошибки
        eloValueElement.removeAttribute('data-elo-range');
    } else {
        eloValueElement.style.color = '#ffffff'; // Белый по умолчанию
        eloValueElement.removeAttribute('data-elo-range');
    }
}

// Форматирование статистики
function formatStat(value) {
    // 0 - это валидное значение, не должно возвращать '---'
    if (value === 0 || value === '0') {
        return '0';
    }
    
    if (value === 'N/A' || value === null || value === undefined || value === '') {
        return '---';
    }
    
    if (typeof value === 'number') {
        // Если число с плавающей точкой и меньше 1, оставляем 2 знака после запятой
        if (value < 1 && value > 0) {
            return value.toFixed(2);
        }
        // Если целое число, форматируем с разделителями тысяч
        return Number.isInteger(value) ? value.toLocaleString('ru-RU') : value.toFixed(2);
    }
    
    // Если строка уже содержит %, возвращаем как есть
    if (typeof value === 'string' && value.includes('%')) {
        return value;
    }
    
    return String(value);
}

// Форматирование ELO
function formatElo(elo) {
    if (typeof elo === 'number') {
        return elo.toLocaleString('ru-RU');
    }
    return elo;
}

// Получение названия ранга
function getRankName(level) {
    const ranks = {
        1: 'Level 1',
        2: 'Level 2',
        3: 'Level 3',
        4: 'Level 4',
        5: 'Level 5',
        6: 'Level 6',
        7: 'Level 7',
        8: 'Level 8',
        9: 'Level 9',
        10: 'Level 10'
    };
    
    return ranks[level] || `Level ${level}` || '---';
}

// Показ панели настроек
function showConfig() {
    const panel = document.getElementById('configPanel');
    panel.classList.add('show');
}

// ==================== TWITCH STREAM TRACKING ====================

// Проверка статуса Twitch стрима
async function checkTwitchStream() {
    try {
        const channel = config.twitchChannel;
        
        // Используем публичный API Twitch (может требовать Client ID)
        const headers = {
            'Accept': 'application/json'
        };
        
        if (TWITCH_CLIENT_ID && TWITCH_CLIENT_ID !== 'YOUR_TWITCH_CLIENT_ID') {
            headers['Client-ID'] = TWITCH_CLIENT_ID;
        }
        
        // Получаем информацию о пользователе
        const userResponse = await fetch(
            `${TWITCH_API_BASE}/users?login=${channel}`,
            { headers }
        );
        
        if (!userResponse.ok) {
            // Пробуем альтернативный метод через публичный API
            await checkTwitchStreamAlternative();
            return;
        }
        
        const userData = await userResponse.json();
        if (!userData.data || userData.data.length === 0) {
            updateStreamStatus(false, 'Канал не найден');
            return;
        }
        
        const userId = userData.data[0].id;
        
        // Проверяем, идет ли стрим
        const streamResponse = await fetch(
            `${TWITCH_API_BASE}/streams?user_id=${userId}`,
            { headers }
        );
        
        if (streamResponse.ok) {
            const streamData = await streamResponse.json();
            const isLive = streamData.data && streamData.data.length > 0;
            
            if (isLive) {
                const stream = streamData.data[0];
                handleStreamStart(stream);
            } else {
                handleStreamEnd();
            }
        } else {
            // Пробуем альтернативный метод
            await checkTwitchStreamAlternative();
        }
        
    } catch (error) {
        console.error('Ошибка проверки Twitch стрима:', error);
        await checkTwitchStreamAlternative();
    }
}

// Альтернативный метод проверки Twitch стрима (через публичный API)
async function checkTwitchStreamAlternative() {
    try {
        const channel = config.twitchChannel;
        // Используем публичный API без авторизации
        const response = await fetch(
            `https://decapi.me/twitch/uptime/${channel}`
        );
        
        if (response.ok) {
            const text = await response.text();
            const isLive = !text.includes('offline') && !text.includes('not found') && text.trim() !== '';
            
            if (isLive) {
                handleStreamStart({ started_at: new Date().toISOString() });
            } else {
                handleStreamEnd();
            }
        } else {
            updateStreamStatus(false, 'Не удалось проверить стрим');
        }
    } catch (error) {
        console.error('Ошибка альтернативной проверки Twitch:', error);
        updateStreamStatus(false, 'Ошибка проверки');
    }
}

// Обработка начала стрима
function handleStreamStart(streamData) {
    const now = new Date().toISOString();
    
    // Если стрим уже идет, не создаем новую сессию
    if (streamSession && streamSession.isLive) {
        updateStreamStatus(true, 'Стрим идет');
        return;
    }
    
    // Создаем новую сессию стрима
    streamSession = {
        id: `stream_${Date.now()}`,
        startTime: streamData.started_at || now,
        isLive: true,
        channel: config.twitchChannel
    };
    
    // Очищаем начальную статистику - она будет сохранена при первом получении данных
    initialStats = null;
    localStorage.removeItem('initialStats');
    
    // Сохраняем сессию
    saveStreamSession();
    
    updateStreamStatus(true, 'Стрим идет');
    console.log('Стрим начался, сессия создана:', streamSession);
    
    // Запрашиваем данные для сохранения начальной статистики
    if (config.faceitNickname) {
        fetchPlayerData();
    }
}

// Обработка окончания стрима
function handleStreamEnd() {
    if (streamSession && streamSession.isLive) {
        streamSession.isLive = false;
        streamSession.endTime = new Date().toISOString();
        
        // Сохраняем финальную статистику
        saveStreamSession();
        
        // Сохраняем сессию в историю
        saveStreamToHistory();
        
        updateStreamStatus(false, 'Стрим окончен');
        console.log('Стрим окончен, сессия сохранена:', streamSession);
        
        // Очищаем текущую сессию
        streamSession = null;
        initialStats = null;
        localStorage.removeItem('currentStreamSession');
        localStorage.removeItem('initialStats');
    } else {
        updateStreamStatus(false, 'Стрим не идет');
    }
}

// Сохранение начальной статистики
function saveInitialStats() {
    // Получаем текущую статистику как начальную
    fetchPlayerData().then(() => {
        // Статистика будет сохранена после получения данных
    });
}

// Вычисление статистики за стрим
function calculateStreamStats(currentStats) {
    if (!streamSession || !streamSession.isLive) {
        // Если стрим не идет, возвращаем общую статистику
        return currentStats;
    }
    
    if (!initialStats) {
        // Если начальная статистика еще не сохранена, возвращаем общую статистику
        console.log('Начальная статистика еще не сохранена');
        return currentStats;
    }
    
    const streamStats = {
        wins: 0,
        losses: 0,
        winRate: '0%',
        kd: 'N/A'
    };
    
    // Вычисляем разницу между текущей и начальной статистикой
    // Wins
    if (typeof currentStats.wins === 'number') {
        if (typeof initialStats.wins === 'number') {
            streamStats.wins = Math.max(0, currentStats.wins - initialStats.wins);
        } else {
            // Если начальная статистика не содержит wins, используем текущую
            streamStats.wins = currentStats.wins;
        }
    }
    
    // Вычисляем Losses с помощью Wins и Win Rate за стрим
    // Используем Win Rate из начальной и текущей статистики для вычисления Win Rate за стрим
    let streamWinRatePercent = null;
    
    // Вычисляем Win Rate за стрим из разницы Wins
    if (typeof streamStats.wins === 'number' && streamStats.wins > 0) {
        // Пробуем получить Win Rate из текущей статистики
        let currentWinRate = null;
        if (typeof currentStats.winRate === 'string' && currentStats.winRate.includes('%')) {
            currentWinRate = parseFloat(currentStats.winRate.replace('%', ''));
        } else if (typeof currentStats.winRate === 'number') {
            currentWinRate = currentStats.winRate;
        }
        
        // Если есть Win Rate, используем его для вычисления Losses
        if (currentWinRate !== null && currentWinRate > 0) {
            // Total Matches за стрим = Wins за стрим / (Win Rate / 100)
            // Но Win Rate за стрим может отличаться от общего Win Rate
            // Поэтому вычисляем из общего Win Rate и Wins за стрим
            const totalMatches = Math.round(streamStats.wins / (currentWinRate / 100));
            streamStats.losses = Math.max(0, totalMatches - streamStats.wins);
            console.log('Losses вычислено из Wins и Win Rate (за стрим):', {
                wins: streamStats.wins,
                winRate: currentWinRate + '%',
                totalMatches: totalMatches,
                losses: streamStats.losses
            });
        }
    }
    
    // Если Losses все еще не вычислено или равно 0, пробуем из разницы
    if (streamStats.losses === 0) {
        // Пробуем вычислить из разницы Losses
        if (typeof currentStats.losses === 'number') {
            if (typeof initialStats.losses === 'number') {
                streamStats.losses = Math.max(0, currentStats.losses - initialStats.losses);
                console.log('Losses вычислено из разницы:', {
                    currentLosses: currentStats.losses,
                    initialLosses: initialStats.losses,
                    streamLosses: streamStats.losses
                });
            } else {
                // Если начальная статистика не содержит losses, используем текущую
                streamStats.losses = currentStats.losses;
                console.log('Losses взято из текущей статистики:', streamStats.losses);
            }
        } else {
            // Если нет данных о Losses, вычисляем из Total Matches если доступно
            // Но для стрима это не нужно, так как мы уже вычислили из Win Rate
            // Оставляем 0 только если действительно нет данных
            console.log('Losses не найдено, оставляем 0');
        }
    }
    
    // Вычисляем Win Rate за стрим из Wins и Losses
    const totalMatches = streamStats.wins + streamStats.losses;
    if (totalMatches > 0) {
        streamStats.winRate = ((streamStats.wins / totalMatches) * 100).toFixed(1) + '%';
    } else {
        streamStats.winRate = '0%';
    }
    
    // K/D за стрим - используем текущий K/D (так как это среднее значение за все игры)
    // В идеале нужно получать K/D только по играм за стрим, но это требует дополнительных запросов к API
    if (typeof currentStats.kd === 'number') {
        streamStats.kd = currentStats.kd.toFixed(2);
    } else if (currentStats.kd && currentStats.kd !== 'N/A') {
        streamStats.kd = currentStats.kd;
    }
    
    console.log('Статистика за стрим:', streamStats, 'Начальная:', initialStats, 'Текущая:', currentStats);
    
    return streamStats;
}

// Сохранение сессии стрима
function saveStreamSession() {
    if (streamSession) {
        localStorage.setItem('currentStreamSession', JSON.stringify(streamSession));
    }
}

// Загрузка сессии стрима
function loadStreamSession() {
    try {
        const saved = localStorage.getItem('currentStreamSession');
        if (saved) {
            streamSession = JSON.parse(saved);
            
            // Проверяем, не устарела ли сессия (если стрим не идет более 5 минут, считаем его оконченным)
            if (streamSession.isLive) {
                const lastCheck = new Date(streamSession.lastCheck || streamSession.startTime);
                const now = new Date();
                const diffMinutes = (now - lastCheck) / (1000 * 60);
                
                if (diffMinutes > 5) {
                    // Стрим, вероятно, окончен
                    handleStreamEnd();
                } else {
                    // Загружаем начальную статистику
                    loadInitialStats();
                }
            }
        }
        
        loadInitialStats();
    } catch (error) {
        console.error('Ошибка загрузки сессии стрима:', error);
    }
}

// Сохранение начальной статистики
function saveInitialStatsToStorage(stats) {
    if (stats && streamSession) {
        initialStats = stats;
        localStorage.setItem('initialStats', JSON.stringify(stats));
        localStorage.setItem(`stream_${streamSession.id}_initial`, JSON.stringify(stats));
    }
}

// Загрузка начальной статистики
function loadInitialStats() {
    try {
        const saved = localStorage.getItem('initialStats');
        if (saved) {
            initialStats = JSON.parse(saved);
        }
    } catch (error) {
        console.error('Ошибка загрузки начальной статистики:', error);
    }
}

// Сохранение стрима в историю
function saveStreamToHistory() {
    if (!streamSession) return;
    
    try {
        const history = JSON.parse(localStorage.getItem('streamHistory') || '[]');
        history.push({
            ...streamSession,
            initialStats: JSON.parse(localStorage.getItem(`stream_${streamSession.id}_initial`) || '{}'),
            finalStats: null // Можно добавить финальную статистику при окончании
        });
        
        // Сохраняем только последние 50 стримов
        if (history.length > 50) {
            history.shift();
        }
        
        localStorage.setItem('streamHistory', JSON.stringify(history));
    } catch (error) {
        console.error('Ошибка сохранения истории стрима:', error);
    }
}

// Обновление статуса стрима в UI (убрано, так как плашка удалена)
function updateStreamStatus(isLive, text) {
    // Плашка статуса стрима удалена из интерфейса
    if (streamSession && streamSession.isLive) {
        streamSession.lastCheck = new Date().toISOString();
        saveStreamSession();
    }
}

