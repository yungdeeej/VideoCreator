{ pkgs }: {
  deps = [
    pkgs.nodejs_22
    pkgs.ffmpeg          # required for the combine/export step
  ];
}
