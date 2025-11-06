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
        
        // Если идет стрим, вычисляем статистику за стрим
        if (streamSession && streamSession.isLive) {
            // Сохраняем начальную статистику при первом получении данных после начала стрима
            if (!initialStats) {
                saveInitialStatsToStorage(stats);
                // Показываем 0 при начале стрима
                stats = {
                    wins: 0,
                    losses: 0,
                    winRate: '0%',
                    kd: 'N/A'
                };
            } else {
                // Вычисляем статистику за стрим
                stats = calculateStreamStats(stats);
            }
        }
        
        updateDisplay(elo, config.faceitNickname, getRankName(level), avatar, stats);
        
    } catch (error) {
        console.error('Ошибка API метода:', error);
        console.error('Детали ошибки:', {
            nickname: config.faceitNickname,
            apiKey: FACEIT_API_KEY ? 'Установлен' : 'Не установлен',
            error: error.message
        });
        
        // Показываем более понятное сообщение об ошибке
        if (error.message.includes('не найден')) {
            updateDisplay('ERROR', 'Игрок не найден', 'Проверьте никнейм', '', null);
        } else if (error.message.includes('API ключ')) {
            updateDisplay('ERROR', 'Ошибка API ключа', 'Проверьте ключ', '', null);
        } else {
            updateDisplay('ERROR', error.message.substring(0, 30) + '...', '---', '', null);
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
        
        // Если идет стрим, вычисляем статистику за стрим
        if (streamSession && streamSession.isLive) {
            // Сохраняем начальную статистику при первом получении данных после начала стрима
            if (!initialStats) {
                saveInitialStatsToStorage(stats);
                // Показываем 0 при начале стрима
                stats = {
                    wins: 0,
                    losses: 0,
                    winRate: '0%',
                    kd: 'N/A'
                };
            } else {
                // Вычисляем статистику за стрим
                stats = calculateStreamStats(stats);
            }
        }
        
        updateDisplay(elo, config.faceitNickname, getRankName(level), avatar, stats);
        
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

// Обновление отображения
function updateDisplay(elo, playerName, rank, avatar = '', stats = null) {
    const eloElement = document.getElementById('eloValue');
    const nameElement = document.getElementById('playerName');
    const rankElement = document.getElementById('rankBadge').querySelector('.rank-text');
    const avatarElement = document.getElementById('playerAvatar');
    const avatarPlaceholder = document.getElementById('avatarPlaceholder');
    
    // Анимация обновления
    eloElement.style.transform = 'scale(0.9)';
    setTimeout(() => {
        eloElement.textContent = elo === 'N/A' || elo === 'ERROR' ? elo : formatElo(elo);
        eloElement.style.transform = 'scale(1)';
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
    
    // Обновление статистики
    if (stats) {
        console.log('Обновление статистики в UI:', stats);
        const winsElement = document.getElementById('statWins');
        const lossesElement = document.getElementById('statLosses');
        const winRateElement = document.getElementById('statWinRate');
        const kdElement = document.getElementById('statKD');
        
        if (winsElement) {
            winsElement.textContent = formatStat(stats.wins);
            console.log('Wins установлено:', formatStat(stats.wins));
        }
        if (lossesElement) {
            lossesElement.textContent = formatStat(stats.losses);
            console.log('Losses установлено:', formatStat(stats.losses));
        }
        if (winRateElement) {
            winRateElement.textContent = formatStat(stats.winRate);
            console.log('Win Rate установлено:', formatStat(stats.winRate));
        }
        if (kdElement) {
            kdElement.textContent = formatStat(stats.kd);
            console.log('K/D установлено:', formatStat(stats.kd));
        }
    } else {
        console.log('Статистика не передана в updateDisplay');
    }
    
    // Изменение цвета в зависимости от ELO (в стиле WINLINE - белый/оранжевый)
    if (typeof elo === 'number') {
        // Удаляем предыдущие атрибуты
        eloElement.removeAttribute('data-elo-range');
        
        if (elo >= 2000) {
            eloElement.style.color = '#ff6b35'; // Оранжевый для высокого ELO
            eloElement.setAttribute('data-elo-range', 'high');
        } else if (elo >= 1500) {
            eloElement.style.color = '#ff8c5a'; // Светло-оранжевый
            eloElement.setAttribute('data-elo-range', 'medium');
        } else if (elo >= 1000) {
            eloElement.style.color = '#ffffff'; // Белый
            eloElement.setAttribute('data-elo-range', 'low');
        } else {
            eloElement.style.color = '#ffffff'; // Белый
            eloElement.setAttribute('data-elo-range', 'low');
        }
    } else if (elo === 'ERROR') {
        eloElement.style.color = '#ff6b35'; // Оранжевый для ошибки
        eloElement.removeAttribute('data-elo-range');
    } else {
        eloElement.style.color = '#ffffff'; // Белый по умолчанию
        eloElement.removeAttribute('data-elo-range');
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

