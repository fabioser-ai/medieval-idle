# Medieval Idle Game — Documento de Design v1

Data: 17 de setembro de 2026  
Status: visão de produto aprovada para prototipação  
Plataforma inicial: iPhone  
Engine proposta: Unity 6  
Linguagem: C#

## 1. Visão

Um jogo idle de estratégia medieval em pixel art no qual o jogador governa um reino, forma exércitos e conquista territórios. A habilidade do jogador é exercida antes da batalha: reconhecimento, escolha de quantidade, formação e proporção de experiência. Depois que o exército deixa o castelo, não existem comandos, poderes ou correções. A batalha é o veredito da estratégia escolhida.

O jogo foi pensado para sessões curtas, tipicamente de um a dois minutos, mantendo progresso significativo durante períodos de ausência.

## 2. Princípios centrais

1. Estratégia e paciência vencem; dinheiro não compra poder.
2. Todos os jogadores têm acesso às mesmas unidades e possibilidades militares.
3. Não existem heróis especiais, armas exclusivas, magia ou vantagens aleatórias decisivas.
4. Tempo produz quantidade; combate e sobrevivência produzem qualidade.
5. Mortes são persistentes. Sobreviventes têm valor histórico e militar.
6. Uma derrota deve doer, mas nunca tornar a recuperação impossível.
7. O jogador sempre pode vencer por boa estratégia ou, mais lentamente, por paciência e superioridade numérica.
8. O combate não aceita intervenção depois de iniciado.

## 3. Identidade visual e apresentação

- Pixel art autenticamente retrô, com pixels grandes e visíveis, bordas duras, paleta limitada e escala nearest-neighbor.
- Referência técnica visual: cena renderizada em baixa resolução interna, aproximadamente 480 × 270, ampliada sem suavização.
- Câmera lateral distante e estratégica.
- Tela em orientação landscape.
- Castelo do jogador sobre uma colina à esquerda e fortaleza ou acampamento inimigo sobre outra colina à direita.
- Vale central onde os exércitos se encontram.
- Cores, nome, brasão e bandeira do reino definidos pelo jogador.
- Tropas comuns e visualmente legíveis: infantaria, arqueiros, lanceiros e cavalaria, com outras classes convencionais desbloqueadas gradualmente.

## 4. Sequência de batalha

1. O jogador conclui o reconhecimento e prepara o exército.
2. Define quantidades, posições e proporções de experiência.
3. Confirma o ataque; a decisão se torna irreversível.
4. Os portões dos dois lados se abrem.
5. Todas as unidades fisicamente saem dos castelos ou acampamentos; nenhuma tropa surge no meio do campo.
6. As forças descem as colinas marchando em formação.
7. Ao se aproximarem, aceleram para a carga conforme o tipo de unidade.
8. O combate continua automaticamente até restar tropa viva de apenas um lado.
9. Não há retirada, rendição ou prisioneiros: vitória por último exército sobrevivente.
10. Os sobreviventes retornam ao seu reino e preservam a experiência adquirida.

A duração não é artificialmente fixa. Batalhas equilibradas devem durar aproximadamente um a dois minutos. Uma força enorme contra um único soldado deve durar essencialmente o tempo necessário para descer a colina e alcançá-lo. Controles de pausa, câmera e velocidade alteram apenas a visualização, nunca o resultado.

## 5. Preparação do exército

O jogador controla três dimensões:

### 5.1 Quantidade

Define quantas unidades de cada classe serão comprometidas. Tropas mantidas em reserva permanecem seguras em caso de derrota.

### 5.2 Formação

O campo de preparação possui cinco posições:

- Linha de frente
- Linha intermediária
- Retaguarda
- Flanco esquerdo
- Flanco direito

O jogador atribui classes e quantidades às posições; o jogo organiza automaticamente os indivíduos dentro de cada grupo.

### 5.3 Proporção de experiência

Para cada grupo, o jogador escolhe a combinação de:

- Recrutas
- Treinados
- Veteranos
- Elite

Assim, dois exércitos com a mesma quantidade e formação podem ter forças muito diferentes.

## 6. Experiência e sobrevivência

A experiência pertence às tropas sobreviventes, organizada internamente em coortes para evitar a necessidade de administrar milhares de indivíduos.

- Tropas novas sempre entram como recrutas.
- Sobreviventes avançam conforme participação, vitórias e sobrevivência.
- Recrutar grandes quantidades não cria experiência e pode diluir a qualidade média do exército.
- Um pequeno exército veterano pode superar uma força maior composta por recrutas.
- Sacrifícios repetidos deixam o reino numeroso, mas militarmente inexperiente.
- Cada classe evolui separadamente; experiência de infantaria não melhora arqueiros ou cavalaria.

## 7. Veteranos como instrutores

Veteranos e tropas de elite podem ser designados como instrutores de sua própria classe.

- Instrutores aumentam a quantidade de novos recrutas produzidos por unidade de tempo.
- Um instrutor não pode participar de batalha enquanto estiver treinando.
- O jogador decide quanto poder preservar no reino e quanto arriscar na campanha.
- Existe uma taxa mínima permanente de recrutamento para impedir um ciclo irreversível de derrota.

Regra central: todo veterano pode ajudar a vencer a batalha de hoje ou construir o exército de amanhã, mas não pode fazer ambos ao mesmo tempo.

## 8. Sistema idle

- Novos soldados são produzidos pelo tempo, não por moedas.
- O progresso offline respeita os mesmos limites e instrutores da atividade online.
- Vitórias, eficiência e posição no ranking podem conceder bônus moderados de tempo.
- Esses bônus usam retornos decrescentes para não tornar líderes inalcançáveis.
- Não há compra de tempo, soldados, experiência ou inteligência.

## 9. Reconhecimento e scouts

Scouts são personagens persistentes e valiosos.

- Ganham experiência ao sobreviver missões.
- O jogador escolhe o nível de risco da missão, de conservador a agressivo.
- Missões conservadoras preservam o scout, mas trazem informação limitada.
- Missões agressivas podem revelar mais detalhes, mas aumentam risco de ferimento, captura ou morte.
- Scouts melhores entregam faixas numéricas mais estreitas, identificam qualidade, reservas, formação e efeitos do terreno com maior confiança.
- Relatórios são expressos como estimativas e níveis de confiança, não como certeza automática.
- Informações incorretas normalmente serão incompletas ou imprecisas, não deliberadamente enganosas.
- Relatórios envelhecem porque forças inimigas sobreviventes podem se recompor.

## 10. Exércitos inimigos e persistência

- Cada território possui uma força inimiga fixa, independente do tamanho do exército do jogador.
- O jogo não escala inimigos secretamente para punir preparação.
- Scouts permitem espiar a força existente antes do ataque.
- Nenhum território deve ser matematicamente impossível com os recursos e unidades disponíveis.
- Se o jogador perde depois de causar baixas, as baixas inimigas permanecem.
- Sobreviventes inimigos mantêm sua experiência.
- O inimigo começa a recompor recrutas ao longo do tempo.
- Um contra-ataque rápido enfrenta um inimigo ainda enfraquecido; esperar permite reconstrução dos dois lados.

## 11. Relação entre unidades

O sistema usa soft counters:

- Lanceiros têm vantagem forte contra cavalaria.
- Cavalaria ameaça arqueiros expostos.
- Arqueiros castigam infantaria lenta à distância.
- Infantaria protege linhas posteriores e sustenta o combate frontal.

Nenhuma relação determina automaticamente o resultado. Quantidade, experiência, posição, terreno e contato efetivo podem superar uma desvantagem de classe.

## 12. Terreno

O terreno tem impacto moderado e legível:

- Ataques em subida são mais lentos.
- Florestas reduzem eficiência de arqueiros e ocultam tropas.
- Lama prejudica cavalaria.
- Passagens estreitas limitam superioridade numérica.
- Planícies favorecem cavalaria e grandes formações.
- Terrenos fortificados beneficiam defensores sem torná-los invencíveis.

O jogador vê características óbvias no cenário; scouts podem revelar implicações menos evidentes.

## 13. Campanha e conquista

- O mundo é dividido em territórios conectados.
- Territórios formam campanhas contra reinos distintos.
- A conquista de um território avança visualmente a fronteira do jogador.
- Cada novo reino introduz cenário, composição inimiga e desafio tático próprios, mantendo as mesmas regras fundamentais.
- Conquistar o último território encerra aquele mundo.

Ao concluir um mundo, o jogador recebe registro histórico e recompensas cosméticas, como coroa, acabamento de bandeira ou decoração do castelo. Uma nova campanha mais difícil começa em igualdade militar, sem poder permanente herdado.

## 14. Kings Ranking

### Fase inicial

- Ranking inteiramente offline com reis controlados por IA.
- Rivais progridem ao longo do tempo, possuem nomes e preferências militares, e mudam de posição.
- A interface é preparada conceitualmente para futura inclusão de humanos.

### Fase futura

- Ranking online separado para jogadores reais.
- Contas, servidor e proteção contra fraude entram apenas depois da validação do jogo offline.
- Jogadores antigos não recebem vantagem militar permanente sobre novos jogadores.

Critérios possíveis incluem velocidade de conquista, eficiência, sobrevivência, vitórias e dificuldade da campanha.

## 15. Modos de preparação

- Manual Commander: o jogador define pessoalmente quantidade, formação e proporção de experiência.
- Automatic Commander: o jogador cria regras permanentes de composição, risco e preservação; o reino monta futuras forças automaticamente.

Ambos os modos terminam no início da batalha. Nenhum permite intervenção durante o combate.

## 16. Som

Direção híbrida:

- Música medieval com influência retrô, discreta e não repetitiva.
- Portões, passos, armaduras, escudos, cavalos, arcos, flechas e impacto com tratamento mais naturalista.
- Camadas coletivas representam grandes exércitos sem tocar um áudio independente para cada unidade.
- A intensidade sonora acompanha quantidade, distância e fase da batalha.
- O silêncio progressivo comunica as baixas.
- Vitória e derrota recebem assinaturas musicais curtas.

## 17. Monetização

- Download gratuito e jogo completo disponível sem compra de poder.
- Anúncios intersticiais discretos apenas entre batalhas e nunca durante combate.
- Nenhum banner permanente cobrindo a interface.
- Compra única para remover anúncios para sempre.
- Nenhuma venda de soldados, experiência, scouts, informação, bônus de tempo ou vantagem de ranking.
- Futuras compras, caso existam, ficam limitadas a cosméticos que não alteram atributos.

## 18. Stack técnico proposto

- Unity 6
- C#
- Projeto 2D em landscape
- Git e GitHub
- VS Code inicialmente
- Xcode para builds, testes e publicação no iPhone
- TestFlight para testes privados
- Persistência local no protótipo
- Simulação determinística separada da animação visual
- Object pooling para grandes quantidades de sprites
- Testes automatizados para cálculos de combate, experiência, recrutamento, scout e progresso offline

## 19. Arquitetura conceitual

### Campaign System

Gerencia mapas, territórios, reinos inimigos, desbloqueios e conclusão de mundos.

### Kingdom System

Mantém identidade visual, reservas, instrutores, produção temporal e histórico.

### Army System

Mantém classes, coortes de experiência, disponibilidade e seleção de implantação.

### Formation System

Transforma as cinco posições e quantidades escolhidas em grupos de combate.

### Scout System

Calcula tempo, risco, sobrevivência, precisão e envelhecimento de relatórios.

### Combat Simulator

Resolve movimento, alcance, soft counters, terreno, dano, morte e sobrevivência sem depender da renderização.

### Battle Renderer

Representa visualmente o resultado da simulação com sprites, animação, câmera, efeitos e som.

### Progression System

Calcula experiência de coortes, treinamento por veteranos, bônus temporais e registros históricos.

### Ranking System

Começa com rivais de IA offline e mantém fronteira clara para um serviço online posterior.

## 20. Tratamento de tempo e integridade

- O progresso offline é calculado a partir de timestamps persistidos.
- Alterações absurdas no relógio do dispositivo não podem gerar progressão ilimitada.
- Saves devem usar escrita segura e versão de esquema.
- Resultados de batalha são calculados de forma reproduzível a partir do estado salvo e de uma seed registrada.
- O futuro ranking online exigirá validação no servidor; essa complexidade não pertence ao primeiro protótipo.

## 21. Primeiro protótipo jogável

O protótipo valida somente o coração do jogo:

- Um campo com duas colinas e dois portões.
- Pixel art temporária no estilo aprovado.
- Quatro classes: infantaria, arqueiros, lanceiros e cavalaria.
- Cinco posições de formação.
- Quatro níveis de experiência.
- Um terreno de planície.
- Um inimigo fixo.
- Saída física dos castelos, marcha, aceleração e batalha automática.
- Vitória por último exército sobrevivente.
- Sobreviventes persistentes.
- Sem mapa, ranking, anúncios, compras, servidor ou sistema completo de scouts.

O protótipo é aprovado quando uma pessoa consegue observar duas composições diferentes, compreender visualmente por que os resultados diferiram e desejar tentar novamente com outra estratégia.

## 22. Escopo explicitamente fora do protótipo

- Multiplayer em tempo real
- Ranking humano online
- Contas de usuário
- Backend próprio
- Clãs
- Chat
- Heróis
- Magia
- Unidades raras pagas
- Loja de poder
- Campanhas sazonais
- Sistema completo de anúncios
- Arte final completa

## 23. Critérios de sucesso do produto

1. Uma sessão produtiva cabe em aproximadamente dois minutos.
2. O jogador entende que perdeu por decisão própria, não por trapaça do jogo.
3. Quantidade, formação, experiência, reconhecimento e terreno alteram resultados de forma perceptível.
4. Preservar veteranos e scouts cria apego sem depender de heróis especiais.
5. Esperar é válido; jogar com inteligência é mais rápido.
6. Assistir à descida das tropas e ao choque das linhas é prazeroso por si só.
7. Monetização não interfere na justiça competitiva.

## 24. Regra síntese

**Escolha sua força. Escolha sua formação. Escolha quem você está disposto a perder. Depois, viva com a decisão.**
