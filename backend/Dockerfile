
# Stage 1 — Compile the application
FROM maven:3.9-eclipse-temurin-21 AS build

WORKDIR /app

COPY pom.xml .
COPY src ./src

# Tests run separately in CI before deployment.
RUN mvn -B -DskipTests package


# Stage 2 — Run the compiled application
FROM eclipse-temurin:21-jre-jammy

WORKDIR /app

COPY --from=build \
    /app/target/library-management-*.jar \
    app.jar

EXPOSE 8080

USER 10001

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
