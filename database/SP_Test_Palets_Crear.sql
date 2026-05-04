-- Stored Procedure para crear un palet
CREATE PROCEDURE [dbo].[SP_Test_Palets_Crear]
    @ProcesoId INT,
    @AcopioId INT,
    @UsuarioId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @NuevoNumero INT;
    DECLARE @NuevoId INT;
    
    -- Obtener el siguiente número de palet para el acopio
    SELECT @NuevoNumero = ISNULL(MAX(COALESCE(NumeroPalet, Numero)), 0) + 1
    FROM Palets 
    WHERE AcopioId = @AcopioId;
    
    -- Insertar el nuevo palet
    INSERT INTO Palets (
        Numero,
        NumeroPalet,
        Estado,
        CantidadCajas,
        PesoTotal,
        PorcentajeAvance,
        FormatoId,
        ProcesoId,
        AcopioId,
        FechaCreacion,
        UsuarioCreacionId
    )
    VALUES (
        @NuevoNumero,
        @NuevoNumero,
        'ABIERTO',
        0,
        0,
        0,
        NULL,
        @ProcesoId,
        @AcopioId,
        GETDATE(),
        @UsuarioId
    );
    
    SET @NuevoId = SCOPE_IDENTITY();
    
    -- Devolver el palet creado
    SELECT 
        p.Id,
        p.Numero,
        p.NumeroPalet,
        p.Estado,
        p.CantidadCajas,
        p.PesoTotal,
        p.PorcentajeAvance,
        p.FormatoId,
        p.ProcesoId,
        p.AcopioId,
        p.FechaCreacion,
        p.FechaCierre,
        p.Observaciones,
        p.MedidaCorrectiva,
        f.Descripcion AS FormatoDescripcion,
        f.LimiteCajasPorPalet,
        a.Codigo AS AcopioCodigo,
        a.Nombre AS AcopioNombre,
        pr.Turno,
        p.NumeroViaje,
        p.PrimeraComposicionFecha
    FROM 
        Palets p
        LEFT JOIN Formatos f ON p.FormatoId = f.Id
        LEFT JOIN Acopios a ON p.AcopioId = a.Id
        LEFT JOIN Procesos pr ON p.ProcesoId = pr.Id
    WHERE 
        p.Id = @NuevoId;
END
