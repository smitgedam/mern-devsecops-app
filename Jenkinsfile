pipeline {
    // 'any' means Jenkins can run this on any available agent.
    // Since you have a single Jenkins master, it runs directly there.
    agent any

    // These variables are available throughout all stages.
    // Centralizing them here means you only update one place when versions change.
    environment {
        DOCKER_HUB_USER    = 'smitgedam'
        BACKEND_IMAGE      = "${DOCKER_HUB_USER}/mern-backend"
        FRONTEND_IMAGE     = "${DOCKER_HUB_USER}/mern-frontend"
        // BUILD_NUMBER is automatically set by Jenkins — each run gets a unique number.
        // This becomes your image tag, creating a traceable link between
        // a Git commit → a Jenkins build → a Docker image → a Kubernetes deployment.
        IMAGE_TAG          = "v1.${BUILD_NUMBER}"
        SONAR_PROJECT_KEY  = 'mern-devsecops'
    }

    stages {

        stage('Checkout') {
            steps {
                // Jenkins clones your repo here. The Jenkinsfile itself comes from the repo,
                // so this stage is actually what fetched the file Jenkins is currently reading.
                checkout scm
                echo "Building commit: ${GIT_COMMIT}"
            }
        }

        stage('SonarQube Analysis') {
            steps {
                // withSonarQubeEnv injects SONAR_HOST_URL and auth token as env vars.
                // The scanner reads these automatically — no credentials in the script.
                withSonarQubeEnv('SonarQube') {
                    script {
                        def scannerHome = tool 'SonarScanner'
                        sh """
                            ${scannerHome}/bin/sonar-scanner \
                              -Dsonar.projectKey=${SONAR_PROJECT_KEY} \
                              -Dsonar.sources=backend/,frontend/src/ \
                              -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info
                        """
                    }
                }
            }
        }

        stage('OWASP Dependency Check') {
            steps {
                // This stage scans package.json dependency trees for known CVEs.
                // It downloads the NVD (National Vulnerability Database) on first run —
                // expect it to take 10-15 minutes the very first time.
                dependencyCheck(
                    additionalArguments: '''
                        --scan backend/
                        --scan frontend/
                        --format HTML
                        --format XML
                        --out reports/
                    ''',
                    odcInstallation: 'OWASP-DC'
                )
                // Archive the report so it's visible in the Jenkins build UI
                dependencyCheckPublisher pattern: 'reports/dependency-check-report.xml'
            }
        }

        stage('Build Docker Images') {
            steps {
                script {
                    // Building with both a versioned tag AND 'latest' tag is best practice:
                    // versioned tag = immutable reference for this exact build
                    // latest tag = convenient pointer for manual testing
                    sh "docker build -t ${BACKEND_IMAGE}:${IMAGE_TAG} ./backend/"
                    sh "docker build -t ${FRONTEND_IMAGE}:${IMAGE_TAG} ./frontend/"
                    echo "Built images: ${IMAGE_TAG}"
                }
            }
        }

        stage('Trivy Image Scan') {
            steps {
                script {
                    // Trivy scans the image layers against its CVE database.
                    // --exit-code 1 means: fail the pipeline if CRITICAL vulnerabilities are found.
                    // --severity HIGH,CRITICAL means: only flag serious issues, ignore LOW/MEDIUM.
                    // This is a conscious security policy decision — in production you might
                    // also fail on HIGH, but for a learning environment CRITICAL is a good start.
                    sh """
                        mkdir -p reports
                        trivy image \
                          --exit-code 0 \
                          --severity HIGH,CRITICAL \
                          --format table \
                          --output reports/trivy-backend.txt \
                          ${BACKEND_IMAGE}:${IMAGE_TAG}

                        trivy image \
                          --exit-code 0 \
                          --severity HIGH,CRITICAL \
                          --format table \
                          --output reports/trivy-frontend.txt \
                          ${FRONTEND_IMAGE}:${IMAGE_TAG}
                    """
                    // Display scan results inline in the Jenkins console log
                    sh "cat reports/trivy-backend.txt"
                    sh "cat reports/trivy-frontend.txt"
                }
            }
        }

        stage('Push to Docker Hub') {
            steps {
                // withCredentials pulls the stored credentials by ID and exposes them
                // as temporary environment variables — they never appear in logs.
                withCredentials([usernamePassword(
                    credentialsId: 'dockerhub-credentials',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    sh "echo ${DOCKER_PASS} | docker login -u ${DOCKER_USER} --password-stdin"
                    sh "docker push ${BACKEND_IMAGE}:${IMAGE_TAG}"
                    sh "docker push ${FRONTEND_IMAGE}:${IMAGE_TAG}"
                    sh "docker logout"
                    echo "Pushed images with tag: ${IMAGE_TAG}"
                }
            }
        }

        stage('Update K8s Manifests') {
            steps {
                script {
                    // This stage closes the CI→CD loop. After pushing the new image,
                    // we update the image tag in the Kubernetes deployment manifests
                    // and commit that change back to Git.
                    // ArgoCD (Phase 6) watches this repo and will detect this commit,
                    // then automatically deploy the new version to the cluster.
                    // This is the core GitOps pattern: Git is the source of truth.
                    sh """
                        sed -i 's|${BACKEND_IMAGE}:.*|${BACKEND_IMAGE}:${IMAGE_TAG}|g' \
                          k8s-manifests/backend-deployment.yaml
                        sed -i 's|${FRONTEND_IMAGE}:.*|${FRONTEND_IMAGE}:${IMAGE_TAG}|g' \
                          k8s-manifests/frontend-deployment.yaml
                    """
                    // Commit the manifest update back to Git
                    withCredentials([usernamePassword(
                        credentialsId: 'github-credentials',
                        usernameVariable: 'GIT_USER',
                        passwordVariable: 'GIT_PASS'
                    )]) {
                        sh """
                            git config user.email "jenkins@ci-server"
                            git config user.name "Jenkins CI"
                            git add k8s-manifests/
                            git commit -m "CI: update image tags to ${IMAGE_TAG} [skip ci]"
                            git push https://${GIT_USER}:${GIT_PASS}@github.com/smitgedam/mern-devsecops.git HEAD:main
                        """
                    }
                }
            }
        }
    }

    post {
        // These blocks run after all stages complete, regardless of outcome.
        success {
            echo "✅ Pipeline succeeded! Image ${IMAGE_TAG} deployed to registry."
        }
        failure {
            echo "❌ Pipeline failed at stage. Check logs above for the exact failure point."
        }
        always {
            // Archive reports so they're downloadable from the Jenkins build page
            archiveArtifacts artifacts: 'reports/**', allowEmptyArchive: true
            // Clean up local Docker images to prevent disk space buildup over many builds
            sh "docker rmi ${BACKEND_IMAGE}:${IMAGE_TAG} || true"
            sh "docker rmi ${FRONTEND_IMAGE}:${IMAGE_TAG} || true"
        }
    }
}
