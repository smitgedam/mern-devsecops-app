pipeline {
    agent any

    environment {
        DOCKER_HUB_USER   = 'smitgedam'
        BACKEND_IMAGE     = "${DOCKER_HUB_USER}/mern-backend"
        FRONTEND_IMAGE    = "${DOCKER_HUB_USER}/mern-frontend"
        IMAGE_TAG         = "v1.${BUILD_NUMBER}"
        SONAR_PROJECT_KEY = 'mern-devsecops'
        // Path to the OWASP CLI we installed directly on the system.
        // By defining it here, every stage can reference it and you
        // only need to update it in one place if it ever moves.
        OWASP_DC          = '/opt/dependency-check/bin/dependency-check.sh'
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
                echo "Building commit: ${GIT_COMMIT}"
            }
        }

        stage('SonarQube Analysis') {
            steps {
                // withSonarQubeEnv injects the server URL and auth token
                // as environment variables so the scanner finds them automatically.
                withSonarQubeEnv('SonarQube') {
                    script {
                        def scannerHome = tool 'SonarScanner'
                        sh """
                            ${scannerHome}/bin/sonar-scanner \
                              -Dsonar.projectKey=${SONAR_PROJECT_KEY} \
                              -Dsonar.sources=backend/,frontend/src/
                        """
                    }
                }
            }
        }

        stage('OWASP Dependency Check') {
            steps {
                script {
                    sh "mkdir -p reports"
                    // We call the CLI directly instead of relying on the Jenkins
                    // plugin tool resolution, which was failing with a null path.
                    // The first run downloads the NVD vulnerability database (~200MB)
                    // and takes 10-15 minutes. Every run after that uses the cache
                    // and completes in about 2 minutes.
                    sh """
                        ${OWASP_DC} \
                          --scan backend/ \
                          --scan frontend/ \
                          --format HTML \
                          --format XML \
                          --out reports/ \
                          --project mern-devsecops
                    """
                }
                // This publishes the XML report as a trend graph in the Jenkins UI.
                // allowEmptyArchive means the pipeline won't fail if the file is missing.
                dependencyCheckPublisher pattern: 'reports/dependency-check-report.xml'
            }
        }

        stage('Build Docker Images') {
            steps {
                script {
                    sh "docker build -t ${BACKEND_IMAGE}:${IMAGE_TAG} ./backend/"
                    sh "docker build -t ${FRONTEND_IMAGE}:${IMAGE_TAG} ./frontend/"
                    echo "Built images with tag: ${IMAGE_TAG}"
                }
            }
        }

        stage('Trivy Image Scan') {
            steps {
                script {
                    sh "mkdir -p reports"
                    // --exit-code 0 means Trivy reports findings but does NOT
                    // fail the pipeline. Change this to 1 once you're comfortable
                    // with your baseline vulnerability count — that's when you
                    // enforce a hard security gate.
                    sh """
                        trivy image \
                          --exit-code 0 \
                          --severity HIGH,CRITICAL \
                          --format table \
                          --output reports/trivy-backend.txt \
                          ${BACKEND_IMAGE}:${IMAGE_TAG}
                    """
                    sh """
                        trivy image \
                          --exit-code 0 \
                          --severity HIGH,CRITICAL \
                          --format table \
                          --output reports/trivy-frontend.txt \
                          ${FRONTEND_IMAGE}:${IMAGE_TAG}
                    """
                    // Print scan results directly into the console log
                    // so you can read them without downloading the file.
                    sh "cat reports/trivy-backend.txt"
                    sh "cat reports/trivy-frontend.txt"
                }
            }
        }

        stage('Push to Docker Hub') {
            steps {
                // withCredentials pulls the stored credentials by ID and exposes
                // them as temporary env vars. They are masked in all log output.
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
                    // sed replaces the old image tag with the new one in-place.
                    // This is what closes the CI→CD loop: the manifest change
                    // gets committed to Git, and ArgoCD (Phase 6) detects it
                    // and automatically deploys the new version to the cluster.
                    sh """
                        sed -i 's|${BACKEND_IMAGE}:.*|${BACKEND_IMAGE}:${IMAGE_TAG}|g' \
                          k8s-manifests/backend-deployment.yaml
                        sed -i 's|${FRONTEND_IMAGE}:.*|${FRONTEND_IMAGE}:${IMAGE_TAG}|g' \
                          k8s-manifests/frontend-deployment.yaml
                    """
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
        success {
            echo "Pipeline succeeded! Image ${IMAGE_TAG} is live in the registry."
        }
        failure {
            echo "Pipeline failed. Check the stage logs above for the exact error."
        }
        always {
            // Save all scan reports as downloadable artifacts on the build page.
            archiveArtifacts artifacts: 'reports/**', allowEmptyArchive: true
            // Clean up local images after every build to prevent disk exhaustion
            // over many builds. The || true ensures cleanup never fails the pipeline.
            sh "docker rmi ${BACKEND_IMAGE}:${IMAGE_TAG} || true"
            sh "docker rmi ${FRONTEND_IMAGE}:${IMAGE_TAG} || true"
        }
    }
}
