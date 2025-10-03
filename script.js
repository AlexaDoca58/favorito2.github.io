// Hacemos las funciones globales para que el HTML pueda llamarlas
let playNextTrack;
let playPrevTrack;
let togglePlayPause; // Hacemos esta global para el botón "Reproducir" de arriba

document.addEventListener('DOMContentLoaded', () => {
    // 1. OBTENER ELEMENTOS DEL DOM
    const playPauseBtn = document.getElementById('play-pause-btn');
    const trackTitle = document.getElementById('track-title');
    const trackArtistInfo = document.getElementById('track-artist-info'); 
    const visualizerCanvas = document.getElementById('frequency-visualizer');
    const canvasCtx = visualizerCanvas.getContext('2d');
    
    // NUEVOS ELEMENTOS
    const progressBar = document.getElementById('progress-bar');
    // NOTA: mixBtn y playAllBtn no están en el HTML que me diste, 
    // pero se pueden añadir fácilmente si quieres esa funcionalidad
    const mixBtn = document.querySelector('.mix-btn');
    const playAllBtn = document.querySelector('.play-all-btn');
    const tracklistCardsContainer = document.getElementById('tracklist-cards'); // Contenedor de las CARDS

    // Elemento de mensaje de error/info (ya en tu HTML)
    const errorMessage = document.getElementById('error-message');

    // 2. LISTA DE CANCIONES (¡CON DURACIÓN!)

    const tracks = [

        { title: 'Once Upon a Time', src: './Audio/01. Once Upon A Time.mp3', duration: '1:03' },

        { title: 'Fallen Down', src: './Audio/04. Fallen Down.mp3', duration: '1:48' },

        { title: 'Your Best Friend', src: './Audio/03. Your Best Friend.mp3', duration: '0:30' },

        { title: 'Ruins', src: './Audio/05. Ruins.mp3', duration: '1:33' },

        { title: 'Heartache', src: './Audio/14. Heartache.mp3', duration: '1:49' },

        { title: 'Snowdin Town', src: './Audio/22. Snowdin Town.mp3', duration: '1:16' }

    ];

    const audio = new Audio();
    let currentTrackIndex = 0;
    let audioContext;
    let analyser;
    let sourceNode = null;
    let dataArray;
    let animationId;
    let isUserInteraction = false;
    let isShuffling = false; 

    // Función de Utilidad
    const formatTime = (seconds) => {
        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60);
        return `${min}:${sec.toString().padStart(2, '0')}`;
    };

    const showError = (message) => {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000);
    };

    // 3. FUNCIONES DE AUDIO CONTEXT Y VISUALIZADOR
    const initAudioContext = () => {
        if (!audioContext) {
            try {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                analyser = audioContext.createAnalyser();
                analyser.fftSize = 256;
                const bufferLength = analyser.frequencyBinCount;
                dataArray = new Uint8Array(bufferLength);
                
                if (!sourceNode) {
                    sourceNode = audioContext.createMediaElementSource(audio);
                    sourceNode.connect(analyser);
                    analyser.connect(audioContext.destination);
                }
            } catch (error) {
                showError('Error al inicializar el audio. Asegúrate de que el navegador lo soporte.');
                return false;
            }
        }
        return true;
    };

    const drawVisualizer = () => {
        if (!analyser || audio.paused) {
            stopVisualizer();
            return;
        }
        
        animationId = requestAnimationFrame(drawVisualizer);
        
        analyser.getByteFrequencyData(dataArray);

        // Ajustar tamaño del canvas
        visualizerCanvas.width = visualizerCanvas.clientWidth;
        visualizerCanvas.height = visualizerCanvas.clientHeight;
        
        canvasCtx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);

        const barWidth = (visualizerCanvas.width / dataArray.length) * 2.5;
        let x = 0;

        for (let i = 0; i < dataArray.length; i++) {
            const barHeight = (dataArray[i] / 255) * visualizerCanvas.height;
            
            // Usamos el color secundario (Rojo/Amarillo) para el visualizador
            const gradient = canvasCtx.createLinearGradient(0, visualizerCanvas.height - barHeight, 0, visualizerCanvas.height);
            gradient.addColorStop(0, '#ff0000'); // Rojo
            gradient.addColorStop(1, '#ffd700'); // Amarillo
            
            canvasCtx.fillStyle = gradient;
            canvasCtx.fillRect(x, visualizerCanvas.height - barHeight, barWidth, barHeight);
            x += barWidth + 2;
        }
    };

    const stopVisualizer = () => {
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        if (canvasCtx) {
            // Limpiar el canvas
            visualizerCanvas.width = visualizerCanvas.clientWidth;
            visualizerCanvas.height = visualizerCanvas.clientHeight;
            canvasCtx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
        }
    };
    
    // 4. LÓGICA DEL REPRODUCTOR
    
    const updateTrackInfo = () => {
        const track = tracks[currentTrackIndex];
        trackTitle.textContent = track.title;
        // La duración real se actualiza cuando el audio está listo (loadedmetadata)
        trackArtistInfo.textContent = `Toby Fox · ${track.duration || '--:--'}`; 

        // Actualizar el estado 'active' de las tarjetas
        document.querySelectorAll('.track-card').forEach((card, i) => {
            card.classList.toggle('active', i === currentTrackIndex);
        });
    };

    const loadTrack = (index) => {
        stopVisualizer();
        
        currentTrackIndex = index;
        audio.src = tracks[currentTrackIndex].src;
        updateTrackInfo();
        
        audio.load();
        progressBar.value = 0;
        
        // El botón principal de Reproducir/Pausa está fuera de esta función,
        // así que lo actualizamos si está reproduciendo.
        if (!audio.paused) {
            playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        }
    };
    
    // Hacemos togglePlayPause global para el botón "Reproducir" del player-header
    togglePlayPause = (forcePlay = false) => {
        if (!audio.src) {
            loadTrack(0);
        }
        
        if (audio.paused || forcePlay) {
            // Se requiere interacción del usuario para iniciar el AudioContext
            if (!isUserInteraction) {
                if (!initAudioContext()) return;
                isUserInteraction = true;
            }
            
            if (audioContext && audioContext.state === 'suspended') {
                audioContext.resume().catch(() => {
                    showError('Error al reanudar el audio. Haz clic nuevamente.');
                    return;
                });
            }
            
            audio.play().then(() => {
                playPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
                // Cambiamos el icono del botón grande de Reproducir/Pausa
                document.querySelector('.player-actions .primary').innerHTML = '<i class="fa-solid fa-pause"></i> Pausar';
                drawVisualizer();
            }).catch(error => {
                showError("Error al reproducir. Revisa la ruta de tus archivos de audio.");
                playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
            });
        } else {
            audio.pause();
            playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
            document.querySelector('.player-actions .primary').innerHTML = '<i class="fa-solid fa-play"></i> Reproducir';
            stopVisualizer();
        }
    };

    playNextTrack = () => {
        let nextIndex;
        if (isShuffling) {
            let randomIndex;
            do {
                randomIndex = Math.floor(Math.random() * tracks.length);
            } while (randomIndex === currentTrackIndex);
            nextIndex = randomIndex;
        } else {
            nextIndex = (currentTrackIndex + 1) % tracks.length;
        }
        
        loadTrack(nextIndex);
        if (!audio.paused || isUserInteraction) {
            setTimeout(() => togglePlayPause(true), 100); // Forzar la reproducción
        }
    };

    playPrevTrack = () => {
        // Si han pasado más de 3 segundos, reinicia la canción, si no, va a la anterior
        if (audio.currentTime > 3) {
            audio.currentTime = 0;
            return;
        }
        
        const prevIndex = (currentTrackIndex - 1 + tracks.length) % tracks.length;
        loadTrack(prevIndex);
        if (!audio.paused || isUserInteraction) {
            setTimeout(() => togglePlayPause(true), 100); // Forzar la reproducción
        }
    };

    const handleMixToggle = () => {
        isShuffling = !isShuffling;
        if (mixBtn) {
            mixBtn.classList.toggle('active', isShuffling);
            mixBtn.innerHTML = isShuffling 
                ? '<i class="fa-solid fa-shuffle"></i> Mezcla ACTIVA'
                : '<i class="fa-solid fa-shuffle"></i> Mezclar';
        }
        showError(isShuffling ? 'Mezcla (Shuffle) activada.' : 'Mezcla (Shuffle) desactivada.');
    };

    const handlePlayAll = () => {
        loadTrack(0);
        isShuffling = false; 
        if (mixBtn) mixBtn.classList.remove('active');
        setTimeout(() => togglePlayPause(true), 100);
        showError('Reproducción en orden iniciada.');
    };

    // 5. RENDERIZACIÓN DE LA LISTA (COMO CARDS)
    const renderTracklist = () => {
        tracklistCardsContainer.innerHTML = '';
        tracks.forEach((track, index) => {
            const card = document.createElement('div');
            card.classList.add('track-card');
            card.dataset.index = index;
            card.innerHTML = `
                <span class="track-id">${track.id.toString().padStart(2, '0')}</span>
                <span class="track-title">${track.title}</span>
                <span class="track-duration">${track.duration}</span>
            `;
            card.addEventListener('click', () => {
                loadTrack(index);
                setTimeout(() => togglePlayPause(true), 100); // Forzar la reproducción
            });
            tracklistCardsContainer.appendChild(card);
        });
    };
    
    // 6. LÓGICA DE LA BARRA DE PROGRESO
    audio.addEventListener('timeupdate', () => {
        const currentTime = audio.currentTime;
        const duration = audio.duration;
        
        if (!isNaN(duration)) {
            const progressPercent = (currentTime / duration) * 100;
            progressBar.value = progressPercent;
        }
    });

    audio.addEventListener('loadedmetadata', () => {
        if (!isNaN(audio.duration)) {
            // Actualizar la duración en la cabecera cuando el archivo está listo
            const durationText = formatTime(audio.duration);
            trackArtistInfo.textContent = `Toby Fox · ${durationText}`;
        }
    });

    progressBar.addEventListener('input', () => {
        const duration = audio.duration;
        if (!isNaN(duration)) {
            const newTime = (progressBar.value * duration) / 100;
            audio.currentTime = newTime;
        }
    });

    // 7. ASIGNACIÓN DE EVENT LISTENERS Y SETUP
    
    // Botón principal de Play/Pause en los controles inferiores
    playPauseBtn.addEventListener('click', () => togglePlayPause());
    
    // Botones de acción (si existen en el HTML final)
    if (mixBtn) mixBtn.addEventListener('click', handleMixToggle);
    if (playAllBtn) playAllBtn.addEventListener('click', handlePlayAll);

    // Navegación (Música/Arte)
    document.querySelectorAll('.nav-top-btn').forEach(item => {
        item.addEventListener('click', (event) => {
            document.querySelectorAll('.nav-top-btn').forEach(i => i.classList.remove('active'));
            event.currentTarget.classList.add('active');
            
            const sectionId = event.currentTarget.dataset.section;
            document.querySelectorAll('.content-section').forEach(section => {
                section.classList.toggle('active', section.id === `${sectionId}-section`);
            });
        });
    });
    
    // Funcionalidad para botones dummy
    document.querySelectorAll('.dummy-action').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const text = e.currentTarget.textContent.trim().replace(/[\u{1F600}-\u{1F6FF}]/gu, '').trim(); // Limpiar emojis si los hay
            showError(`La función "${text}" es sólo visual/dúmmy.`);
        });
    });


    audio.addEventListener('ended', playNextTrack);
    audio.addEventListener('error', (e) => {
        showError('Error al cargar el audio. Archivos no encontrados en la carpeta Audio/.');
    });

    // Inicialización
    renderTracklist();
    loadTrack(0);
    
    // Ajuste de Canvas para el visualizador
    const resizeCanvas = () => {
        visualizerCanvas.width = visualizerCanvas.clientWidth;
        visualizerCanvas.height = visualizerCanvas.clientHeight;
    };
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
});
