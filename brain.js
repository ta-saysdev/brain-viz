const container = document.getElementById('container');
const mousePosition = { x: 0, y: 0 };
let renderer, scene, camera, particleSystem, raycaster;
const lines = [];

function init() {
    // Scene setup
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ 
        alpha: true,
        antialias: true 
    });

    renderer.setClearColor(0x000000, 0);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    // Particle setup
    const particlesGeometry = new THREE.BufferGeometry();
    const particleCount = 600;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const originalColors = new Float32Array(particleCount * 3);

    const radius = 2.5;
    const hemisphereGap = 0.4;

    // Create particles in a spherical pattern
    for (let i = 0; i < particleCount; i++) {
        const idx = i * 3;
        const phi = Math.acos(1 - 2 * (i / particleCount));
        const theta = Math.PI * 2 * i * (1 + Math.sqrt(5));

        let x = radius * Math.sin(phi) * Math.cos(theta);
        let y = radius * Math.sin(phi) * Math.sin(theta);
        let z = radius * Math.cos(phi);

        // Create hemisphere separation
        if (x > 0) x += hemisphereGap;
        if (x < 0) x -= hemisphereGap;

        // Add subtle variation
        x += (Math.random() - 0.5) * 0.2;
        y += (Math.random() - 0.5) * 0.2;
        z += (Math.random() - 0.5) * 0.2;

        positions[idx] = x;
        positions[idx + 1] = y;
        positions[idx + 2] = z;

        // Create blue gradient
        const intensity = Math.abs(y / radius);
        originalColors[idx] = 0.4 + intensity * 0.3;     // R
        originalColors[idx + 1] = 0.5 + intensity * 0.3; // G
        originalColors[idx + 2] = 0.9 + intensity * 0.1; // B

        colors[idx] = originalColors[idx];
        colors[idx + 1] = originalColors[idx + 1];
        colors[idx + 2] = originalColors[idx + 2];
    }

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const linesMaterial = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.15
    });

    const particlesMaterial = new THREE.PointsMaterial({
        size: 0.12,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true
    });

    particleSystem = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particleSystem);

    // Raycaster setup
    raycaster = new THREE.Raycaster();
    raycaster.params.Points.threshold = 0.8;

    camera.position.z = 8;

    // Event listeners
    window.addEventListener('resize', onWindowResize, false);
    document.addEventListener('mousemove', onMouseMove, false);

    // Start animation
    animate();
}

// Animation constants
const maxDistance = 1.5;
const attractionStrength = 0.03;
const maxAttractionDistance = 3;
let lastConnectionUpdate = 0;
const connectionUpdateInterval = 50;

function updateParticleConnections() {
    const now = Date.now();
    if (now - lastConnectionUpdate < connectionUpdateInterval) return;
    lastConnectionUpdate = now;

    // Clear old lines
    lines.forEach(line => scene.remove(line));
    lines.length = 0;

    const positions = particleSystem.geometry.attributes.position.array;
    const colors = particleSystem.geometry.attributes.color.array;
    const originalColors = particleSystem.geometry.attributes.color.array.slice();

    // Reset colors
    for (let i = 0; i < colors.length; i++) {
        colors[i] = originalColors[i];
    }

    raycaster.setFromCamera(mousePosition, camera);
    const intersects = raycaster.intersectObject(particleSystem);

    if (intersects.length > 0) {
        const intersectPoint = intersects[0].point;
        const maxConnectionsPerUpdate = 40;
        let connectionCount = 0;

        for (let i = 0; i < positions.length; i += 3) {
            const x = positions[i];
            const y = positions[i + 1];
            const z = positions[i + 2];

            const distToIntersect = Math.sqrt(
                Math.pow(x - intersectPoint.x, 2) +
                Math.pow(y - intersectPoint.y, 2) +
                Math.pow(z - intersectPoint.z, 2)
            );

            if (distToIntersect < maxAttractionDistance) {
                // Particle attraction
                const force = (1 - distToIntersect / maxAttractionDistance) * attractionStrength;
                positions[i] += (intersectPoint.x - x) * force;
                positions[i + 1] += (intersectPoint.y - y) * force;
                positions[i + 2] += (intersectPoint.z - z) * force;

                // Color transition
                const intensity = 1 - (distToIntersect / maxAttractionDistance);
                colors[i] = originalColors[i] + (1 - originalColors[i]) * intensity;
                colors[i + 1] = originalColors[i + 1] * (1 - intensity);
                colors[i + 2] = originalColors[i + 2] * (1 - intensity);

                // Create connections
                if (connectionCount < maxConnectionsPerUpdate && distToIntersect < maxDistance) {
                    for (let j = i + 3; j < positions.length; j += 6) {
                        const x2 = positions[j];
                        const y2 = positions[j + 1];
                        const z2 = positions[j + 2];

                        const particleDistance = Math.sqrt(
                            Math.pow(x - x2, 2) +
                            Math.pow(y - y2, 2) +
                            Math.pow(z - z2, 2)
                        );

                        if (particleDistance < maxDistance) {
                            const lineGeometry = new THREE.BufferGeometry();
                            const linePositions = new Float32Array([x, y, z, x2, y2, z2]);
                            lineGeometry.setAttribute('position', 
                                new THREE.BufferAttribute(linePositions, 3)
                            );
                            const line = new THREE.Line(lineGeometry, linesMaterial);
                            scene.add(line);
                            lines.push(line);
                            connectionCount++;
                        }
                    }
                }
            }
        }

        particleSystem.geometry.attributes.position.needsUpdate = true;
        particleSystem.geometry.attributes.color.needsUpdate = true;
    }
}

function animate() {
    requestAnimationFrame(animate);
    particleSystem.rotation.y += 0.002;
    particleSystem.rotation.x = Math.sin(Date.now() * 0.0005) * 0.1;
    updateParticleConnections();
    renderer.render(scene, camera);
}

function onMouseMove(event) {
    mousePosition.x = (event.clientX / window.innerWidth) * 2 - 1;
    mousePosition.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Start the visualization
init();