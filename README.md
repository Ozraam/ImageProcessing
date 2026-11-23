# Découpe Papier

Outil web qui ajoute un effet « découpé dans du papier froissé » à un PNG détouré.
Tout le traitement se fait dans le navigateur : aucune image n'est envoyée au serveur.

## Lancer avec Docker Compose

```bash
docker compose up -d --build
```

L'outil est ensuite accessible sur `http://<ip-du-serveur>:8085`.
Pour changer le port, modifiez la ligne `"8085:80"` dans `docker-compose.yml`.

## Lancer sans Compose

```bash
docker build -t decoupe-papier .
docker run -d --name decoupe-papier -p 8085:80 --restart unless-stopped decoupe-papier
```

## Mettre à jour

Remplacez `index.html`, puis relancez `docker compose up -d --build`.

## Notes

- L'image `nginx:alpine` existe en arm64 : elle fonctionne sur un Raspberry Pi 5.
- Les polices viennent de Google Fonts. Sans accès Internet, l'outil fonctionne quand même avec les polices du système.
